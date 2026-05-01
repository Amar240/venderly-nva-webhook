require('dotenv').config();
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand } = require('@aws-sdk/lib-dynamodb');

const client = DynamoDBDocumentClient.from(
  new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-2' })
);

const SCHOOL_IDS = [
  'Iysf1wop405gcFUMRG5J', '0DdNpwmVbVzX4n0GU47Z', 'IBeIvUNndgINH0uxGluM',
  'nrB8duCzIcTSKNql2H4m', 'mRc0CkXiiH60SB2RGSSc', 'JZAPKvVzbwUzO6LVy4H2',
  'nKrHtvDJ5LgTSudQE0WS', 'TZLAuABYVHQXHvqX7PtJ', 'Jx0AVZ4y41gaFX2Wv7w3',
  'Q2NX9AiF3g2RNLebDP10', 'luyXoIV90fEgbBGaUXNX', 'apzJ92HSYt9vQDwWkIY1',
  '2hNRQey4FAzXOR3cuEWA', 'XEMqsMNXM04JxO5Xgy4e', '16lTvLOjys2PSWf5rW3R',
  '4FI8EDi5pNSiDiRjPkE4', 'JGt0oY5phSqDCIOglMSi', 'My9RXdV0hXgxQJKlRVKa',
  'wQkEo0vabVf4WyehIgV5', 'LGyH345tUHoCZd8NLlgj', 'p2Rek3JTvK2PW7abwzER',
  'gRWM5lCAxydSvRfs4Bmm', 'MWbhb5jmptARe4KeaCVr', 'yF81kt240sCtvh4CanC8',
  'fAtxPtahfY627sTbvdut', 'Xz5LqdGzAT14bavuBJzU', 'Zksj53iga8hYgcS6RbXd',
  'dzPgMMEnQga6UCpB8j0n', 'AmtkFTwy3nJ7LjBvnHfM', 'FgQR0HeldUimyuSPIGOK',
  'RskEsi9YT7ssfLnYXPRJ', 'MkI6Y3GyTzCAV4A2eLzO', '1DL8nQZboyp5PgPh6EJo',
  'pUUu6pAswzsYTaHo7gI8', 'eC4RmRMA6yx7FSHd1mOD', 'y2l0vleBPVtzKZUbhqKl',
  'DXgSM2TQC6yzWLrrTlcd', 'vlXwjpaazTebPxLTwsdY', 'rQf1G4ffLSR7yhRasr7J',
  'kbZYcu1a2qlvb1zfhzQh', '3deojLrMQY3JubppvjpD', 'HrRh9J8WDIKGP3GA78bO',
  'pxHqonc3GnsDsI6xtHg2', 'd38BqVcPiqPIxFD9WMMr', 'yTvPIurpX0s5hwRaVzx9',
  'IQSe9z4AlmCY9MoLKJQA', 'RHxWxQUHtKJUKw4RCKeP', 'tarmkhRvGw2m20XqKzvC',
  '33eqJTGmen4RGiW8E1rk', '8ycBDniz3y718OR7vcGC', 'f3J9AbtboECED7mCSdPE',
  'J10DoyJErpltAQoXPvrr', 'GY0rRzhe9lm9hhyRWcjB'
];

const PRO_IDS = [
  'iKon4FuDOAUL4meYWDIk', '8aqnILCXuVMb78SL9Cwd', 'FsVU99POuvJ7q04a2uaK',
  'XmNstaaoM5uQ8SiqFHlE', 'BERsSI5y2p9E7UE52cWi', 'GUbGeXSERprDdBCjUwxc',
  '2aPEzQXhYw4XQXQod2t7', 'cqH570OcwymEkUkhAlYV', '3CrfdneHuzrTP0p8V284',
  'zd0MffOMpnk3oRSB98Tb', 'SCQcqfiyntU9mwzMGD1i', 'xEQAAncqyDgPvGDBuBWh',
  'wywJb7LWpHutbtNfTJOG', '82DqOuOPixiEwJnCepjl', 'tCCPBcfvRwceoDqPJJYo',
  'qVuEXL1ZuSdQy9wIhMch', 'Bjt6c984XN3YKY5porzI', 'BRJ2go0FGQ6aYewDAvyt',
  'SMMaNvytqmM0mmHMb4CW', 'Nr1QVLjx7hBiSPtG1AwC', 'fBUjhpffXtOEB5brcaXF',
  'Dh6M8jerr98HwTR6PXkk', 'oSJHzIy8CwsB8cI4fRJi', '1M9hszRINwKpQjEmD1ep',
  'QTirpz5pk73dFhvcI30R', 'g0Dyaiqo1qyJwnRpZpzw'
];

async function seed() {
  let count = 0;

  for (const locationId of SCHOOL_IDS) {
    await client.send(new PutCommand({
      TableName: 'venderly-subaccounts',
      Item: { locationId, cssGroup: 'SCHOOL', customerType: 'School (District)', createdAt: new Date().toISOString() }
    }));
    count++;
    console.log(`Seeded SCHOOL: ${locationId}`);
  }

  for (const locationId of PRO_IDS) {
    await client.send(new PutCommand({
      TableName: 'venderly-subaccounts',
      Item: { locationId, cssGroup: 'PRO', customerType: 'PRO', createdAt: new Date().toISOString() }
    }));
    count++;
    console.log(`Seeded PRO: ${locationId}`);
  }

  console.log(`\nDone! Seeded ${count} subaccounts total.`);
}

seed().catch(console.error);