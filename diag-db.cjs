require('dotenv').config();

const u = new URL(process.env.DATABASE_URL);
console.log('--- STEP 15 ---');
console.log('raw search string:', u.search);
console.log('parsed parameters:');
for (const [k, v] of u.searchParams) {
  console.log('   ', JSON.stringify(k), '=', JSON.stringify(v));
}
console.log('--- END ---');