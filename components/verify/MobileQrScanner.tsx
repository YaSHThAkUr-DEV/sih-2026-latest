'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import jsQR from 'jsqr';

interface MobileQrScannerProps {
  onScanSuccess: (extractedKey: string) => void;
  onError?: (error: string) => void;
}

export function MobileQrScanner({ onScanSuccess, onError }: MobileQrScannerProps) {
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [availableCameras, setAvailableCameras] = useState<Array<{ deviceId: string; label: string; isBack: boolean }>>([]);
  const [activeDeviceId, setActiveDeviceId] = useState<string | null>(null);
  const [hasTorch, setHasTorch] = useState(false);
  const [isTorchOn, setIsTorchOn] = useState(false);
  const [scanStatus, setScanStatus] = useState<'IDLE' | 'SCANNING' | 'DECODED' | 'ERROR'>('IDLE');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDecodingFile, setIsDecodingFile] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const nativeCameraInputRef = useRef<HTMLInputElement | null>(null);

  /**
   * Helper to format camera device labels cleanly
   */
  const formatCameraLabel = (device: MediaDeviceInfo, index: number): { label: string; isBack: boolean } => {
    const raw = (device.label || '').toLowerCase();
    const isBack = raw.includes('back') || raw.includes('rear') || raw.includes('environment') || !raw.includes('front');
    
    if (device.label) {
      if (raw.includes('wide') && raw.includes('ultra')) return { label: `Rear Ultra-Wide (${index + 1})`, isBack: true };
      if (raw.includes('tele')) return { label: `Rear Telephoto (${index + 1})`, isBack: true };
      if (raw.includes('front') || raw.includes('user') || raw.includes('selfie')) return { label: `Front Camera (${index + 1})`, isBack: false };
      if (raw.includes('back') || raw.includes('rear')) return { label: `Rear Camera (${index + 1})`, isBack: true };
      return { label: device.label, isBack };
    }
    return { label: isBack ? `Back Lens ${index + 1}` : `Front Camera ${index + 1}`, isBack };
  };

  /**
   * Query all available video hardware devices
   */
  const refreshAvailableCameras = useCallback(async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) return;
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter((d) => d.kind === 'videoinput');
      const formatted = videoDevices.map((d, i) => {
        const meta = formatCameraLabel(d, i);
        return {
          deviceId: d.deviceId,
          label: meta.label,
          isBack: meta.isBack,
        };
      });
      setAvailableCameras(formatted);
    } catch (e) {
      console.warn('Failed to enumerate cameras:', e);
    }
  }, []);

  // Enumerate cameras on initial mount
  useEffect(() => {
    refreshAvailableCameras();
  }, [refreshAvailableCameras]);

  /**
   * Smart parser for extracted QR string:
   * Handles JSON payloads, direct verification URLs, Transaction IDs, docket numbers, and hashes.
   */
  const parseQrPayload = useCallback((raw: string): string => {
    const trimmed = raw.trim();
    
    // 1. Try parsing JSON (Section 65B Certificate format)
    try {
      if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
        const parsed = JSON.parse(trimmed);
        if (parsed.sha256) return String(parsed.sha256).trim();
        if (parsed.txId || parsed.transactionId) return String(parsed.txId || parsed.transactionId).trim();
        if (parsed.docket || parsed.documentNumber) return String(parsed.docket || parsed.documentNumber).trim();
        if (parsed.cert || parsed.serialNumber) return String(parsed.cert || parsed.serialNumber).trim();
      }
    } catch {
      // Not JSON, continue to URL parsing
    }

    // 2. Try parsing URL
    try {
      if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.includes('/verify')) {
        const urlObj = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`);
        const keyParam = urlObj.searchParams.get('key') || urlObj.searchParams.get('txId') || urlObj.searchParams.get('hash');
        if (keyParam) return keyParam.trim();

        // Check path parameter e.g. /verify/0x123...
        const pathSegments = urlObj.pathname.split('/').filter(Boolean);
        const lastSegment = pathSegments[pathSegments.length - 1];
        if (lastSegment && lastSegment !== 'verify') {
          return lastSegment.trim();
        }
      }
    } catch {
      // Not a URL, continue
    }

    // 3. Return raw string (SHA256, Transaction ID, Docket Number)
    return trimmed;
  }, []);

  const handleSuccessfulScan = useCallback((rawCode: string) => {
    setScanStatus('DECODED');
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try {
        navigator.vibrate(100);
      } catch {}
    }

    const key = parseQrPayload(rawCode);
    stopCamera();
    onScanSuccess(key);
  }, [parseQrPayload, onScanSuccess]);

  const stopCamera = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
    setIsTorchOn(false);
    setHasTorch(false);
  }, []);

  const safeJsQR = (data: Uint8ClampedArray, width: number, height: number, options?: any) => {
    try {
      const fn = typeof jsQR === 'function' ? jsQR : (jsQR as any)?.default;
      if (typeof fn === 'function') {
        return fn(data, width, height, options);
      }
    } catch (e) {
      console.error('jsQR execution error:', e);
    }
    return null;
  };

  // Frame scanning loop using native BarcodeDetector + jsQR fallback
  const scanFrame = useCallback(async () => {
    if (!videoRef.current || !isCameraActive) return;

    const video = videoRef.current;

    if (video.readyState >= video.HAVE_ENOUGH_DATA) {
      // 1. Try hardware-accelerated BarcodeDetector on video element
      if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
        try {
          const detector = new (window as any).BarcodeDetector({ formats: ['qr_code'] });
          const barcodes = await detector.detect(video);
          if (barcodes && barcodes.length > 0 && barcodes[0].rawValue) {
            handleSuccessfulScan(barcodes[0].rawValue);
            return;
          }
        } catch {
          // Fall through to canvas jsQR
        }
      }

      // 2. Canvas fallback for jsQR
      const canvas = canvasRef.current;
      if (canvas) {
        // Downsample to max 800px for instant real-time frame rate
        const scale = Math.min(1, 800 / Math.max(video.videoWidth || 1, video.videoHeight || 1));
        const w = Math.round((video.videoWidth || 640) * scale);
        const h = Math.round((video.videoHeight || 480) * scale);
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (ctx) {
          ctx.drawImage(video, 0, 0, w, h);
          const imageData = ctx.getImageData(0, 0, w, h);
          const code = safeJsQR(imageData.data, w, h, {
            inversionAttempts: 'attemptBoth',
          });

          if (code && code.data) {
            handleSuccessfulScan(code.data);
            return;
          }
        }
      }
    }

    animationFrameRef.current = requestAnimationFrame(scanFrame);
  }, [isCameraActive, handleSuccessfulScan]);

  const startCamera = async (
    targetDeviceId?: string | null,
    facing: 'environment' | 'user' = facingMode
  ) => {
    stopCamera();
    setErrorMessage(null);
    setScanStatus('SCANNING');

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      const msg = 'Camera access is not supported on this browser. Use photo upload below.';
      setErrorMessage(msg);
      setScanStatus('ERROR');
      if (onError) onError(msg);
      return;
    }

    try {
      let videoConstraint: MediaTrackConstraints;
      if (targetDeviceId) {
        videoConstraint = {
          deviceId: { exact: targetDeviceId },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        };
      } else {
        videoConstraint = {
          facingMode: { ideal: facing },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        };
      }

      const constraints: MediaStreamConstraints = {
        audio: false,
        video: videoConstraint,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true'); // Required for iOS Safari
        await videoRef.current.play();
        setIsCameraActive(true);

        const track = stream.getVideoTracks()[0];
        const settings = track.getSettings ? track.getSettings() : {};
        if (settings.deviceId) {
          setActiveDeviceId(settings.deviceId);
        } else if (targetDeviceId) {
          setActiveDeviceId(targetDeviceId);
        }

        const capabilities = track.getCapabilities ? (track.getCapabilities() as any) : {};
        setHasTorch(Boolean(capabilities.torch));

        // Re-enumerate to get updated human-readable camera labels now that permission is active
        await refreshAvailableCameras();

        animationFrameRef.current = requestAnimationFrame(scanFrame);
      }
    } catch (err: any) {
      console.error('Camera access error:', err);
      let msg = 'Could not access camera. Please check camera permissions in your phone settings.';
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        msg = 'Camera permission was denied. Please allow camera access in your browser.';
      } else if (err.name === 'NotFoundError' || err.name === 'OverconstrainedError') {
        msg = 'Selected camera lens is currently busy or unavailable. Trying default camera...';
        if (targetDeviceId) {
          startCamera(null, facing);
          return;
        }
      }
      setErrorMessage(msg);
      setScanStatus('ERROR');
      if (onError) onError(msg);
    }
  };

  /**
   * Cycle to next camera lens sequentially
   */
  const cycleToNextCamera = () => {
    if (availableCameras.length > 1) {
      const currentIdx = availableCameras.findIndex((c) => c.deviceId === activeDeviceId);
      const nextIdx = (currentIdx + 1) % availableCameras.length;
      const nextCam = availableCameras[nextIdx];
      setActiveDeviceId(nextCam.deviceId);
      setFacingMode(nextCam.isBack ? 'environment' : 'user');
      startCamera(nextCam.deviceId, nextCam.isBack ? 'environment' : 'user');
    } else {
      const nextMode = facingMode === 'environment' ? 'user' : 'environment';
      setFacingMode(nextMode);
      startCamera(null, nextMode);
    }
  };

  /**
   * Switch directly to a specific chosen camera lens
   */
  const switchCameraTo = (deviceId: string) => {
    const chosen = availableCameras.find((c) => c.deviceId === deviceId);
    setActiveDeviceId(deviceId);
    if (chosen) {
      setFacingMode(chosen.isBack ? 'environment' : 'user');
      startCamera(deviceId, chosen.isBack ? 'environment' : 'user');
    } else {
      startCamera(deviceId);
    }
  };

  const toggleTorch = async () => {
    if (!streamRef.current || !hasTorch) return;
    const track = streamRef.current.getVideoTracks()[0];
    try {
      const nextState = !isTorchOn;
      await track.applyConstraints({
        advanced: [{ torch: nextState } as any],
      });
      setIsTorchOn(nextState);
    } catch (e) {
      console.warn('Torch toggle failed:', e);
    }
  };

  /**
   * High-accuracy QR decoder:
   * 1. Uses browser hardware-accelerated BarcodeDetector if available (instant 4K/12MP photo detection)
   * 2. Falls back to multi-scale jsQR (scaling 1200px, 800px, and center crops)
   */
  const detectQrFromImageElement = async (img: HTMLImageElement): Promise<string | null> => {
    // 1. Try native hardware BarcodeDetector (Chrome Android / Safari iOS)
    if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
      try {
        const detector = new (window as any).BarcodeDetector({ formats: ['qr_code'] });
        const barcodes = await detector.detect(img);
        if (barcodes && barcodes.length > 0 && barcodes[0].rawValue) {
          return barcodes[0].rawValue;
        }
      } catch (e) {
        console.warn('Native BarcodeDetector failed, falling back to jsQR:', e);
      }
    }

    // 2. Multi-scale helper for jsQR
    const scales = [1200, 800, 1600, 600];
    const origW = img.naturalWidth || img.width;
    const origH = img.naturalHeight || img.height;

    for (const maxDim of scales) {
      try {
        let targetW = origW;
        let targetH = origH;
        if (origW > maxDim || origH > maxDim) {
          if (origW >= origH) {
            targetW = maxDim;
            targetH = Math.round((origH * maxDim) / origW);
          } else {
            targetH = maxDim;
            targetW = Math.round((origW * maxDim) / origH);
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = targetW;
        canvas.height = targetH;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) continue;

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, targetW, targetH);

        const imageData = ctx.getImageData(0, 0, targetW, targetH);
        const code = safeJsQR(imageData.data, targetW, targetH, {
          inversionAttempts: 'attemptBoth',
        });

        if (code && code.data && code.data.trim()) {
          return code.data.trim();
        }
      } catch (err) {
        console.warn('jsQR scale pass error:', err);
      }
    }

    // 3. Try center crop at 800px (handles photos where QR code is in the middle third)
    try {
      const cropSize = Math.min(origW, origH) * 0.75;
      const cropX = (origW - cropSize) / 2;
      const cropY = (origH - cropSize) / 2;
      const canvas = document.createElement('canvas');
      canvas.width = 800;
      canvas.height = 800;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (ctx) {
        ctx.drawImage(img, cropX, cropY, cropSize, cropSize, 0, 0, 800, 800);
        const imageData = ctx.getImageData(0, 0, 800, 800);
        const code = safeJsQR(imageData.data, 800, 800, {
          inversionAttempts: 'attemptBoth',
        });
        if (code && code.data && code.data.trim()) {
          return code.data.trim();
        }
      }
    } catch {}

    // 4. Try raw unscaled original
    try {
      const canvas = document.createElement('canvas');
      canvas.width = origW;
      canvas.height = origH;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, origW, origH);
        const code = safeJsQR(imageData.data, origW, origH, {
          inversionAttempts: 'attemptBoth',
        });
        if (code && code.data && code.data.trim()) {
          return code.data.trim();
        }
      }
    } catch {}

    return null;
  };

  // Process static image file (from gallery or native camera snap)
  const decodeQrFromImage = (file: File) => {
    setIsDecodingFile(true);
    setErrorMessage(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = async () => {
        try {
          const detectedData = await detectQrFromImageElement(img);
          setIsDecodingFile(false);
          if (detectedData) {
            handleSuccessfulScan(detectedData);
          } else {
            setErrorMessage('No valid QR code was detected in this photo. Please hold steady and try again with good lighting.');
          }
        } catch (err: any) {
          setIsDecodingFile(false);
          setErrorMessage('Decoding failed: ' + err.message);
        }
      };
      img.onerror = () => {
        setIsDecodingFile(false);
        setErrorMessage('Failed to load selected image file.');
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  return (
    <div className="w-full flex flex-col items-center gap-4">
      {/* Hidden offscreen canvas for frame capture */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Main Scanner Container */}
      <div className="w-full max-w-md bg-[#0B1C30] rounded-2xl sm:rounded-3xl border border-[#CBD5E1] p-3 sm:p-4 text-white shadow-xl relative overflow-hidden">
        {/* Top Scanner Header */}
        <div className="flex items-center justify-between pb-3 border-b border-white/10 text-xs">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${isCameraActive ? 'bg-emerald-400 animate-pulse' : 'bg-slate-400'}`}></span>
            <span className="font-bold text-white tracking-wide">
              {isCameraActive ? 'Live Scanner Active' : 'Camera Standby'}
            </span>
            {availableCameras.length > 1 && (
              <span className="text-[10px] font-mono bg-white/10 px-2 py-0.5 rounded-md text-emerald-300">
                {availableCameras.length} Lenses
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            {isCameraActive && hasTorch && (
              <button
                type="button"
                onClick={toggleTorch}
                className={`p-1.5 rounded-lg border transition ${
                  isTorchOn ? 'bg-amber-400 text-slate-950 border-amber-300' : 'bg-white/10 text-white border-white/20 hover:bg-white/20'
                }`}
                title="Toggle Flashlight"
              >
                <span className="material-symbols-outlined text-[18px]">
                  {isTorchOn ? 'flashlight_on' : 'flashlight_off'}
                </span>
              </button>
            )}

            {/* Quick Cycle Camera Button */}
            <button
              type="button"
              onClick={cycleToNextCamera}
              className="px-2 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white border border-white/20 transition cursor-pointer flex items-center gap-1 touch-manipulation active:scale-95"
              title="Switch Camera Lens"
            >
              <span className="material-symbols-outlined text-[18px]">flip_camera_ios</span>
              <span className="text-[10px] font-bold hidden xs:inline">Switch</span>
            </button>
          </div>
        </div>

        {/* Simple & Sleek Camera Selection Menu (Replaces horizontal scrollbar) */}
        {availableCameras.length > 1 && (
          <div className="pt-2.5 pb-1 flex items-center gap-2">
            <div className="relative flex-1">
              <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-emerald-400">
                <span className="material-symbols-outlined text-[16px]">photo_camera</span>
              </div>
              <select
                value={activeDeviceId || (availableCameras[0]?.deviceId ?? '')}
                onChange={(e) => switchCameraTo(e.target.value)}
                className="w-full bg-[#132A4A] hover:bg-[#1B3A64] text-white text-xs font-semibold pl-8 pr-8 py-2 rounded-xl border border-white/20 focus:outline-none focus:ring-2 focus:ring-emerald-400 appearance-none cursor-pointer transition-colors"
              >
                {availableCameras.map((cam, idx) => (
                  <option key={cam.deviceId || idx} value={cam.deviceId} className="bg-[#0B1C30] text-white py-1">
                    {cam.label}
                  </option>
                ))}
              </select>
              <div className="absolute inset-y-0 right-0 pr-2.5 flex items-center pointer-events-none text-slate-300">
                <span className="material-symbols-outlined text-[16px]">arrow_drop_down</span>
              </div>
            </div>
          </div>
        )}

        {/* Video Camera Viewport */}
        <div className="relative w-full aspect-square sm:aspect-4/3 rounded-xl sm:rounded-2xl bg-black overflow-hidden mt-2 flex items-center justify-center">
          <video
            ref={videoRef}
            playsInline
            muted
            className={`w-full h-full object-cover ${isCameraActive ? 'block' : 'hidden'}`}
          />

          {/* Idle / Placeholder View when Camera is off */}
          {!isCameraActive && (
            <div className="flex flex-col items-center justify-center p-5 text-center space-y-3 w-full">
              <div 
                onClick={() => nativeCameraInputRef.current?.click()}
                className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-600/30 to-emerald-600/30 border border-white/20 flex items-center justify-center text-emerald-400 cursor-pointer hover:scale-105 active:scale-95 transition-all shadow-lg"
              >
                <span className="material-symbols-outlined text-[36px]">qr_code_scanner</span>
              </div>
              <div>
                <h4 className="font-bold text-sm text-white">Instant Mobile QR Scanner</h4>
                <p className="text-[11px] text-slate-300 mt-0.5 max-w-xs leading-relaxed">
                  Scan any Section 65B Certificate or Ledger QR to verify directly on the sovereign chain.
                </p>
              </div>

              {/* Main 2 Action Buttons */}
              <div className="flex flex-col sm:flex-row items-center gap-2 w-full max-w-xs pt-1">
                <button
                  type="button"
                  onClick={() => nativeCameraInputRef.current?.click()}
                  className="w-full py-2.5 px-4 bg-[#10B981] hover:bg-[#059669] text-white text-xs font-bold rounded-xl shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 transition cursor-pointer touch-manipulation active:scale-95"
                >
                  <span className="material-symbols-outlined text-[18px]">photo_camera</span>
                  <span>Snap with Phone Camera</span>
                </button>

                <button
                  type="button"
                  onClick={() => startCamera(activeDeviceId, 'environment')}
                  className="w-full py-2.5 px-4 bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-bold rounded-xl shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2 transition cursor-pointer touch-manipulation active:scale-95"
                >
                  <span className="material-symbols-outlined text-[18px]">videocam</span>
                  <span>Live Video Scanner</span>
                </button>
              </div>
            </div>
          )}

          {/* Scanning Reticle & Animated Laser (when Camera is Active) */}
          {isCameraActive && (
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center p-6">
              {/* Target Bounding Box */}
              <div className="w-64 h-64 sm:w-72 sm:h-72 relative border-2 border-emerald-400/40 rounded-2xl">
                {/* 4 Corner Markers */}
                <span className="absolute -top-1 -left-1 w-6 h-6 border-t-3 border-l-3 border-emerald-400 rounded-tl-lg"></span>
                <span className="absolute -top-1 -right-1 w-6 h-6 border-t-3 border-r-3 border-emerald-400 rounded-tr-lg"></span>
                <span className="absolute -bottom-1 -left-1 w-6 h-6 border-b-3 border-l-3 border-emerald-400 rounded-bl-lg"></span>
                <span className="absolute -bottom-1 -right-1 w-6 h-6 border-b-3 border-r-3 border-emerald-400 rounded-br-lg"></span>

                {/* Animated Scanning Laser Line */}
                <div className="absolute left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_12px_#34d399] animate-scan-pulse"></div>

                {/* Center Subtext */}
                <div className="absolute -bottom-8 left-0 right-0 text-center">
                  <span className="text-[11px] font-mono bg-black/70 backdrop-blur-md px-3 py-1 rounded-full text-emerald-300 border border-emerald-500/30">
                    Align QR code inside box
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Decoding Overlay */}
          {isDecodingFile && (
            <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center text-white gap-2 p-4">
              <div className="w-8 h-8 border-3 border-emerald-400 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-xs font-bold text-slate-200">Decoding QR from photo...</p>
            </div>
          )}
        </div>

        {/* Live Camera Bottom Action Controls */}
        {isCameraActive && (
          <div className="flex items-center justify-between pt-3 text-xs">
            <span className="text-[11px] text-slate-300">
              Camera: <strong className="text-white capitalize">{facingMode}</strong>
            </span>
            <button
              type="button"
              onClick={stopCamera}
              className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg transition text-xs flex items-center gap-1 cursor-pointer touch-manipulation active:scale-95"
            >
              <span className="material-symbols-outlined text-[16px]">videocam_off</span>
              <span>Stop Camera</span>
            </button>
          </div>
        )}

        {/* Error Feedback */}
        {errorMessage && (
          <div className="mt-3 p-3 bg-red-950/80 border border-red-500/50 rounded-xl text-xs text-red-200 flex items-start gap-2">
            <span className="material-symbols-outlined text-red-400 text-[18px] shrink-0 mt-0.5">error</span>
            <div className="flex-1 leading-relaxed">
              <p>{errorMessage}</p>
              <button
                type="button"
                onClick={() => nativeCameraInputRef.current?.click()}
                className="mt-2 text-xs font-bold text-emerald-400 underline block cursor-pointer"
              >
                Tap here to Snap QR using Phone Camera instead
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Alternative Phone Fallback Options (Native Camera Photo & File Upload) */}
      <div className="w-full max-w-md bg-white rounded-2xl border border-[#CBD5E1] p-4 text-xs space-y-3 shadow-xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-[#0B1C30] font-bold text-xs">
            <span className="material-symbols-outlined text-[18px] text-[#2563EB]">photo_camera</span>
            <span>Mobile Phone Actions</span>
          </div>
          <span className="text-[10px] font-mono text-[#64748B]">Zero-Upload Client</span>
        </div>

        {/* Hidden inputs */}
        <input
          ref={nativeCameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={(e) => {
            if (e.target.files?.[0]) decodeQrFromImage(e.target.files[0]);
          }}
          className="hidden"
        />
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={(e) => {
            if (e.target.files?.[0]) decodeQrFromImage(e.target.files[0]);
          }}
          className="hidden"
        />

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => nativeCameraInputRef.current?.click()}
            className="p-3 rounded-xl bg-[#EFF6FF] hover:bg-[#DBEAFE] border border-[#BFDBFE] text-[#1E3A8A] font-bold flex flex-col items-center text-center gap-1.5 transition cursor-pointer touch-manipulation active:scale-95"
          >
            <span className="material-symbols-outlined text-[22px] text-[#2563EB]">photo_camera</span>
            <span className="text-[11px] leading-tight">Snap Camera Photo</span>
          </button>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="p-3 rounded-xl bg-[#F8FAFC] hover:bg-[#E2E8F0] border border-[#CBD5E1] text-[#334155] font-bold flex flex-col items-center text-center gap-1.5 transition cursor-pointer touch-manipulation active:scale-95"
          >
            <span className="material-symbols-outlined text-[22px] text-[#475569]">photo_library</span>
            <span className="text-[11px] leading-tight">Pick from Gallery</span>
          </button>
        </div>

        {/* Quick Demo Test Buttons */}
        <div className="pt-2 border-t border-[#E2E8F0]">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#64748B] block mb-1.5">
            ⚡ Instant Mobile Test Demo (Tap to Verify):
          </span>
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => handleSuccessfulScan(JSON.stringify({
                cert: "SEC65B-GENESIS-001",
                docket: "OFFICIAL-DOC-GENESIS",
                sha256: "d0ebd1167c197da4e6a84baf70183426c18a35c036c2867e6880dae720e37bd3",
                txId: "4964a0d25b7422a5fe34826711f54fb0fde6815c589320274d8f99b5d9874ac4"
              }))}
              className="px-2.5 py-1.5 rounded-lg bg-[#F1F5F9] hover:bg-[#0B1C30] hover:text-white border border-[#CBD5E1] text-[#0B1C30] text-[10px] font-mono font-bold transition flex items-center gap-1 cursor-pointer touch-manipulation active:scale-95"
            >
              <span className="material-symbols-outlined text-[13px] text-emerald-500">verified</span>
              <span>Test Genesis Ledger QR</span>
            </button>

            <button
              type="button"
              onClick={() => handleSuccessfulScan(JSON.stringify({
                cert: "SEC65B-COURT-882",
                docket: "OFFICIAL-DOC-GENESIS",
                sha256: "64cc34aea860452b32bc0c8cc50d7f3230f53248cedf2f6cc956b3bc11e94a4f",
                txId: "f189bde35de5672bc0782a775e7207694cae1febc7bab48f7bd3a6f14b79c7f5"
              }))}
              className="px-2.5 py-1.5 rounded-lg bg-[#F1F5F9] hover:bg-[#0B1C30] hover:text-white border border-[#CBD5E1] text-[#0B1C30] text-[10px] font-mono font-bold transition flex items-center gap-1 cursor-pointer touch-manipulation active:scale-95"
            >
              <span className="material-symbols-outlined text-[13px] text-blue-500">verified</span>
              <span>Test Court Docket QR</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
