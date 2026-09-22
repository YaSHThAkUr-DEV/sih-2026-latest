import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

function ensureDir(dirPath: string) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

async function generateFabricCrypto() {
  console.log('--- Generating Clean Fabric MSP Assets (OpenSSL) ---');

  const baseDir = path.resolve(__dirname, '../docker/fabric/crypto-config');
  if (fs.existsSync(baseDir)) {
    fs.rmSync(baseDir, { recursive: true, force: true });
  }
  ensureDir(baseDir);

  const ordererMsp = path.join(baseDir, 'ordererOrganizations/dms.gov.in/msp');
  ensureDir(path.join(ordererMsp, 'admincerts'));
  ensureDir(path.join(ordererMsp, 'cacerts'));
  ensureDir(path.join(ordererMsp, 'signcerts'));
  ensureDir(path.join(ordererMsp, 'keystore'));
  ensureDir(path.join(ordererMsp, 'tlscacerts'));

  const peerMsp = path.join(baseDir, 'peerOrganizations/org1.dms.gov.in/msp');
  ensureDir(path.join(peerMsp, 'admincerts'));
  ensureDir(path.join(peerMsp, 'cacerts'));
  ensureDir(path.join(peerMsp, 'signcerts'));
  ensureDir(path.join(peerMsp, 'keystore'));
  ensureDir(path.join(peerMsp, 'tlscacerts'));

  // 1. Orderer CA & Certificate
  console.log('1. Orderer CA & Certificate...');
  execSync(
    `docker run --rm -v "${ordererMsp}:/msp" alpine/openssl req -x509 -newkey ec -pkeyopt ec_paramgen_curve:prime256v1 -nodes -keyout /msp/keystore/ca.key -out /msp/cacerts/ca.dms.gov.in-cert.pem -days 3650 -subj "/C=IN/ST=Delhi/O=DMS/CN=ca.dms.gov.in" -addext "basicConstraints=critical,CA:TRUE"`,
    { stdio: 'inherit' }
  );

  execSync(
    `docker run --rm -v "${ordererMsp}:/msp" alpine/openssl req -new -newkey ec -pkeyopt ec_paramgen_curve:prime256v1 -nodes -keyout /msp/keystore/server.key -out /msp/keystore/orderer.csr -subj "/C=IN/ST=Delhi/O=DMS/CN=orderer.dms.gov.in"`,
    { stdio: 'inherit' }
  );

  execSync(
    `docker run --rm -v "${ordererMsp}:/msp" alpine/openssl x509 -req -in /msp/keystore/orderer.csr -CA /msp/cacerts/ca.dms.gov.in-cert.pem -CAkey /msp/keystore/ca.key -CAcreateserial -out /msp/signcerts/orderer.dms.gov.in-cert.pem -days 3650`,
    { stdio: 'inherit' }
  );

  fs.copyFileSync(
    path.join(ordererMsp, 'signcerts/orderer.dms.gov.in-cert.pem'),
    path.join(ordererMsp, 'admincerts/admin-cert.pem')
  );
  fs.copyFileSync(
    path.join(ordererMsp, 'cacerts/ca.dms.gov.in-cert.pem'),
    path.join(ordererMsp, 'tlscacerts/tls-ca-cert.pem')
  );
  fs.writeFileSync(path.join(ordererMsp, 'config.yaml'), 'NodeOUs:\n  Enable: false\n');

  // Clean any .srl files from cacerts
  const ordererSrl = path.join(ordererMsp, 'cacerts/ca.dms.gov.in-cert.srl');
  if (fs.existsSync(ordererSrl)) fs.unlinkSync(ordererSrl);
  const ordererCsr = path.join(ordererMsp, 'keystore/orderer.csr');
  if (fs.existsSync(ordererCsr)) fs.unlinkSync(ordererCsr);

  // 2. Peer Org1 CA & Certificate
  console.log('2. Org1 Peer CA & Certificate...');
  execSync(
    `docker run --rm -v "${peerMsp}:/msp" alpine/openssl req -x509 -newkey ec -pkeyopt ec_paramgen_curve:prime256v1 -nodes -keyout /msp/keystore/ca.key -out /msp/cacerts/ca.org1.dms.gov.in-cert.pem -days 3650 -subj "/C=IN/ST=Delhi/O=Org1MSP/CN=ca.org1.dms.gov.in" -addext "basicConstraints=critical,CA:TRUE"`,
    { stdio: 'inherit' }
  );

  execSync(
    `docker run --rm -v "${peerMsp}:/msp" alpine/openssl req -new -newkey ec -pkeyopt ec_paramgen_curve:prime256v1 -nodes -keyout /msp/keystore/server.key -out /msp/keystore/peer.csr -subj "/C=IN/ST=Delhi/O=Org1MSP/CN=peer0.org1.dms.gov.in"`,
    { stdio: 'inherit' }
  );

  execSync(
    `docker run --rm -v "${peerMsp}:/msp" alpine/openssl x509 -req -in /msp/keystore/peer.csr -CA /msp/cacerts/ca.org1.dms.gov.in-cert.pem -CAkey /msp/keystore/ca.key -CAcreateserial -out /msp/signcerts/peer0.org1.dms.gov.in-cert.pem -days 3650`,
    { stdio: 'inherit' }
  );

  fs.copyFileSync(
    path.join(peerMsp, 'signcerts/peer0.org1.dms.gov.in-cert.pem'),
    path.join(peerMsp, 'admincerts/admin-cert.pem')
  );
  fs.copyFileSync(
    path.join(peerMsp, 'cacerts/ca.org1.dms.gov.in-cert.pem'),
    path.join(peerMsp, 'tlscacerts/tls-ca-cert.pem')
  );
  fs.writeFileSync(path.join(peerMsp, 'config.yaml'), 'NodeOUs:\n  Enable: false\n');

  // Clean any .srl files from cacerts
  const peerSrl = path.join(peerMsp, 'cacerts/ca.org1.dms.gov.in-cert.srl');
  if (fs.existsSync(peerSrl)) fs.unlinkSync(peerSrl);
  const peerCsr = path.join(peerMsp, 'keystore/peer.csr');
  if (fs.existsSync(peerCsr)) fs.unlinkSync(peerCsr);

  console.log('✅ Clean Fabric MSP assets generated successfully!');
}

generateFabricCrypto().catch(console.error);
