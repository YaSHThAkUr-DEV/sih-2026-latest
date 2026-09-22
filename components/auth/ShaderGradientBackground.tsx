'use client';

import React from 'react';
import { ShaderGradientCanvas, ShaderGradient } from '@shadergradient/react';

// Suppress known Three.js r183+ Clock deprecation warning emitted by @shadergradient internal loop
if (typeof window !== 'undefined') {
  const originalWarn = console.warn;
  console.warn = (...args: any[]) => {
    if (
      typeof args[0] === 'string' &&
      (args[0].includes('Clock: This module has been deprecated') ||
        args[0].includes('THREE.Clock: This module has been deprecated'))
    ) {
      return;
    }
    originalWarn.apply(console, args);
  };
}

export default function ShaderGradientBackground() {
  return (
    <div className="absolute inset-0 w-full h-full overflow-hidden pointer-events-none -z-10">
      <ShaderGradientCanvas
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
        }}
        lazyLoad={false}
        fov={45}
        pixelDensity={1}
      >
        <ShaderGradient
          control="props"
          animate="on"
          brightness={1.2}
          cAzimuthAngle={170}
          cDistance={4.4}
          cPolarAngle={70}
          cameraZoom={1}
          color1="#94ffd1"
          color2="#6bf5ff"
          color3="#ffffff"
          envPreset="city"
          grain="off"
          lightType="3d"
          positionX={0}
          positionY={0.9}
          positionZ={-0.3}
          range="disabled"
          rangeEnd={40}
          rangeStart={0}
          reflection={0.1}
          rotationX={45}
          rotationY={0}
          rotationZ={0}
          shader="defaults"
          type="waterPlane"
          uAmplitude={0}
          uDensity={1.2}
          uFrequency={0}
          uSpeed={0.2}
          uStrength={3.4}
          uTime={0}
          wireframe={false}
        />
      </ShaderGradientCanvas>
    </div>
  );
}
