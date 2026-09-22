# =============================================================================
# Hyperledger Fabric Network Launcher (PowerShell)
# =============================================================================
# Starts Fabric Peer0, Orderer, CouchDB, and CA containers via Docker Compose.
# =============================================================================

Write-Host "`n========================================================================" -ForegroundColor Cyan
Write-Host "  🏛️  STARTING HYPERLEDGER FABRIC ENTERPRISE DOCKER NETWORK" -ForegroundColor Cyan
Write-Host "========================================================================`n" -ForegroundColor Cyan

$dockerComposePath = "docker/fabric/docker-compose.fabric.yml"

if (-not (Test-Path $dockerComposePath)) {
    Write-Host "❌ Error: Docker compose file not found at $dockerComposePath" -ForegroundColor Red
    exit 1
}

# Check if Docker is running
docker info > $null 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Error: Docker daemon is not running. Please start Docker Desktop first." -ForegroundColor Red
    exit 1
}

Write-Host "⏳ Launching Fabric containers (peer0.org1.dms.gov.in, orderer.dms.gov.in, couchdb0, ca)..." -ForegroundColor Yellow
docker compose -f $dockerComposePath up -d

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n✅ Hyperledger Fabric network successfully launched!" -ForegroundColor Green
    Write-Host "   • Peer0 Endpoint     : grpc://localhost:7051" -ForegroundColor Gray
    Write-Host "   • Orderer Endpoint   : grpc://localhost:7050" -ForegroundColor Gray
    Write-Host "   • CouchDB State DB   : http://localhost:5984" -ForegroundColor Gray
    Write-Host "   • Fabric CA          : http://localhost:7054" -ForegroundColor Gray
    Write-Host "`n💡 To view live logs: npm run fabric:logs" -ForegroundColor Cyan
    Write-Host "💡 To stop network:  npm run fabric:down`n" -ForegroundColor Cyan
} else {
    Write-Host "❌ Failed to start Fabric containers." -ForegroundColor Red
}
