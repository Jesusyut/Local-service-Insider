import test from 'node:test';import assert from 'node:assert/strict';
import {computeRange,verdict,validZip} from '../server/pricing.mjs';
test('no invented data below minimum sample',()=>{assert.equal(computeRange([100,200]),null);assert.equal(computeRange(Array(9).fill(200),{low:100,typical:200,high:300}).source,'seed');});
test('trims extreme values before computing percentiles',()=>{const r=computeRange([1,100,110,120,130,140,150,160,170,99999]);assert.equal(r.typical,135);assert.equal(r.low,114);assert.equal(r.high,156);assert.equal(r.source,'computed');});
test('verdict boundaries and skipped quotes',()=>{const r={low:100,typical:200,high:300};assert.equal(verdict(99,r).verdict,'Low');assert.equal(verdict(100,r).verdict,'Fair');assert.equal(verdict(300,r).verdict,'Fair');assert.equal(verdict(301,r).verdict,'High');assert.equal(verdict(null,r).verdict,'Typical range');assert.equal(verdict(100,null).verdict,'No data');});
test('San Diego coverage rejects out of state and malformed ZIPs',()=>{for(const z of ['92101','92114','92008','91910','92054'])assert.ok(validZip(z),z);for(const z of ['90210','86001','12345','8500','85000'])assert.ok(!validZip(z),z);});
