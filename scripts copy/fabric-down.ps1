# =============================================================================
# Hyperledger Fabric Network Teardown (PowerShell)
# =============================================================================
# Stops and removes Fabric Peer0, Orderer, CouchDB, and CA containers.
# =============================================================================

Write-Host "`n========================================================================" -ForegroundColor Yellow
Write-Host "  🛑 STOPPING HYPERLEDGER FABRIC ENTERPRISE DOCKER NETWORK" -ForegroundColor Yellow
Write-Host "========================================================================`n" -ForegroundColor Yellow

$dockerComposePath = "docker/fabric/docker-compose.fabric.yml"

Write-Host "⏳ Stopping Fabric containers..." -ForegroundColor Yellow
docker compose -f $dockerComposePath down

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n✅ Hyperledger Fabric containers stopped and cleaned up successfully!" -ForegroundColor Green
    Write-Host "   • DMS will automatically fall back to simulated mode seamlessly.`n" -ForegroundColor Gray
} else {
    Write-Host "❌ Failed to stop Fabric containers." -ForegroundColor Red
}
