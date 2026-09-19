const VAULT_ADDR = process.env.VAULT_ADDR || 'http://127.0.0.1:8200';
const VAULT_TOKEN = process.env.VAULT_TOKEN || 'dms-vault-dev-token';

async function main() {
  console.log('Testing Vault endpoints at:', VAULT_ADDR);
  console.log('Token:', VAULT_TOKEN);

  const health = await fetch(`${VAULT_ADDR}/v1/sys/health`);
  console.log('Sys health status:', health.status, await health.json());

  const checkKey = await fetch(`${VAULT_ADDR}/v1/transit/keys/dms-master-key`, {
    headers: { 'X-Vault-Token': VAULT_TOKEN }
  });
  console.log('Check key status:', checkKey.status, await checkKey.text());

  const mounts = await fetch(`${VAULT_ADDR}/v1/sys/mounts`, {
    headers: { 'X-Vault-Token': VAULT_TOKEN }
  });
  console.log('Mounts status:', mounts.status, await mounts.text());

  process.exit(0);
}

main();
