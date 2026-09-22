async function testActualAnchor() {
  const actualTx = '4964a0d25b7422a5fe34826711f54fb0fde6815c589320274d8f99b5d9874ac4';
  const res = await fetch('http://localhost:3000/api/blockchain/public-verify/' + actualTx);
  const data = await res.json();
  console.log('REAL ANCHOR VERIFICATION RESULT:');
  console.log('Verified:', data.verified);
  console.log('Ledger Status:', data.proof?.ledgerStatus);
  console.log('Block Number:', data.proof?.blockNumber);
  console.log('Payload Hash:', data.proof?.payloadHash);
  console.log('Merkle Root:', data.proof?.merkleRoot);
  console.log('Endorsing Peers:', data.proof?.endorsingPeers);
  console.log('Document Details:', data.document);
  console.log('\nFull JSON Payload:\n', JSON.stringify(data, null, 2));
}

testActualAnchor().catch(console.error);
