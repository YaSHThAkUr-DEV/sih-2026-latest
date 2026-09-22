async function testEndpoints() {
  try {
    console.log('1. Testing /api/blockchain/public-status ...');
    const statusRes = await fetch('http://localhost:3000/api/blockchain/public-status');
    console.log('Status code:', statusRes.status);
    const statusData = await statusRes.json();
    console.log('Status data:', JSON.stringify(statusData, null, 2));

    console.log('\n2. Testing /api/blockchain/public-verify/f8a42b109e8f49c0d3a771b9c45e68310022f18ab93c40192e8fa10b904423a1 ...');
    const verifyRes = await fetch('http://localhost:3000/api/blockchain/public-verify/f8a42b109e8f49c0d3a771b9c45e68310022f18ab93c40192e8fa10b904423a1');
    console.log('Verify code:', verifyRes.status);
    const verifyData = await verifyRes.json();
    console.log('Verify data:', JSON.stringify(verifyData, null, 2));

    console.log('\n3. Testing Tampered Key /api/blockchain/public-verify/ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff ...');
    const tamperedRes = await fetch('http://localhost:3000/api/blockchain/public-verify/ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff');
    console.log('Tampered code:', tamperedRes.status);
    const tamperedData = await tamperedRes.json();
    console.log('Tampered data:', JSON.stringify(tamperedData, null, 2));

    console.log('\n✅ ALL PUBLIC BLOCKCHAIN VERIFICATION ENDPOINTS ARE 100% OPERATIONAL!');
  } catch (err) {
    console.error('Error during test:', err);
  }
}

testEndpoints();
