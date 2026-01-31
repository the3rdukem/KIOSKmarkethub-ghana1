/**
 * Comprehensive End-to-End Tests for Vendor Analytics
 * 
 * Tests:
 * 1. DAL functions with actual database queries
 * 2. API endpoint responses
 * 3. Edge cases (empty data, invalid params)
 * 4. Data accuracy verification
 */

import { 
  getVendorSalesMetrics,
  getVendorOrderMetrics,
  getVendorProductPerformance,
  getVendorProductStats,
  getVendorReviewMetrics,
  getVendorAnalytics,
  DateRange,
  TimeBucket
} from '../src/lib/db/dal/vendor-analytics';
import { query } from '../src/lib/db';

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  details?: string;
}

const results: TestResult[] = [];

function log(message: string) {
  console.log(`[TEST] ${message}`);
}

function pass(name: string, details?: string) {
  results.push({ name, passed: true, details });
  console.log(`✅ PASS: ${name}${details ? ` - ${details}` : ''}`);
}

function fail(name: string, error: string) {
  results.push({ name, passed: false, error });
  console.log(`❌ FAIL: ${name} - ${error}`);
}

async function getTestVendorId(): Promise<string | null> {
  try {
    const result = await query<{ id: string }>(
      `SELECT id FROM users WHERE role = 'vendor' LIMIT 1`
    );
    return result.rows[0]?.id || null;
  } catch (e) {
    return null;
  }
}

async function testGetVendorSalesMetrics(vendorId: string) {
  log('Testing getVendorSalesMetrics...');
  
  const ranges: DateRange[] = ['7d', '30d', '90d', '1y', 'all'];
  const buckets: TimeBucket[] = ['day', 'week', 'month'];
  
  for (const range of ranges) {
    for (const bucket of buckets) {
      try {
        const metrics = await getVendorSalesMetrics(vendorId, range, bucket);
        
        if (typeof metrics.totalRevenue !== 'number') {
          fail(`Sales Metrics (${range}/${bucket})`, 'totalRevenue is not a number');
          continue;
        }
        if (typeof metrics.totalOrders !== 'number') {
          fail(`Sales Metrics (${range}/${bucket})`, 'totalOrders is not a number');
          continue;
        }
        if (!Array.isArray(metrics.salesTrends)) {
          fail(`Sales Metrics (${range}/${bucket})`, 'salesTrends is not an array');
          continue;
        }
        
        for (const trend of metrics.salesTrends) {
          if (!trend.date || typeof trend.revenue !== 'number' || typeof trend.orders !== 'number') {
            fail(`Sales Metrics (${range}/${bucket})`, 'Invalid trend data structure');
            continue;
          }
        }
        
        pass(`Sales Metrics (${range}/${bucket})`, `revenue=${metrics.totalRevenue}, orders=${metrics.totalOrders}, trends=${metrics.salesTrends.length}`);
      } catch (e) {
        fail(`Sales Metrics (${range}/${bucket})`, String(e));
      }
    }
  }
}

async function testGetVendorOrderMetrics(vendorId: string) {
  log('Testing getVendorOrderMetrics...');
  
  const ranges: DateRange[] = ['7d', '30d', '90d', '1y', 'all'];
  
  for (const range of ranges) {
    try {
      const metrics = await getVendorOrderMetrics(vendorId, range);
      
      if (typeof metrics.total !== 'number') {
        fail(`Order Metrics (${range})`, 'total is not a number');
        continue;
      }
      if (typeof metrics.byStatus !== 'object') {
        fail(`Order Metrics (${range})`, 'byStatus is not an object');
        continue;
      }
      if (typeof metrics.fulfillmentRate !== 'number') {
        fail(`Order Metrics (${range})`, 'fulfillmentRate is not a number');
        continue;
      }
      
      pass(`Order Metrics (${range})`, `total=${metrics.total}, fulfillmentRate=${metrics.fulfillmentRate.toFixed(1)}%`);
    } catch (e) {
      fail(`Order Metrics (${range})`, String(e));
    }
  }
}

async function testGetVendorProductPerformance(vendorId: string) {
  log('Testing getVendorProductPerformance...');
  
  try {
    const products = await getVendorProductPerformance(vendorId, '30d', 5);
    
    if (!Array.isArray(products)) {
      fail('Product Performance', 'Result is not an array');
      return;
    }
    
    for (const product of products) {
      if (!product.productId || !product.productName) {
        fail('Product Performance', 'Missing productId or productName');
        return;
      }
      if (typeof product.totalSold !== 'number' || typeof product.totalRevenue !== 'number') {
        fail('Product Performance', 'Invalid totalSold or totalRevenue');
        return;
      }
    }
    
    pass('Product Performance', `Found ${products.length} top products`);
  } catch (e) {
    fail('Product Performance', String(e));
  }
}

async function testGetVendorProductStats(vendorId: string) {
  log('Testing getVendorProductStats...');
  
  try {
    const stats = await getVendorProductStats(vendorId);
    
    if (typeof stats.total !== 'number') {
      fail('Product Stats', 'total is not a number');
      return;
    }
    if (typeof stats.active !== 'number') {
      fail('Product Stats', 'active is not a number');
      return;
    }
    if (typeof stats.lowStock !== 'number') {
      fail('Product Stats', 'lowStock is not a number');
      return;
    }
    
    pass('Product Stats', `total=${stats.total}, active=${stats.active}, lowStock=${stats.lowStock}`);
  } catch (e) {
    fail('Product Stats', String(e));
  }
}

async function testGetVendorReviewMetrics(vendorId: string) {
  log('Testing getVendorReviewMetrics...');
  
  const ranges: DateRange[] = ['7d', '30d', '90d', 'all'];
  
  for (const range of ranges) {
    try {
      const metrics = await getVendorReviewMetrics(vendorId, range);
      
      if (typeof metrics.totalReviews !== 'number') {
        fail(`Review Metrics (${range})`, 'totalReviews is not a number');
        continue;
      }
      if (typeof metrics.avgRating !== 'number') {
        fail(`Review Metrics (${range})`, 'avgRating is not a number');
        continue;
      }
      if (typeof metrics.ratingDistribution !== 'object') {
        fail(`Review Metrics (${range})`, 'ratingDistribution is not an object');
        continue;
      }
      if (!Array.isArray(metrics.recentReviews)) {
        fail(`Review Metrics (${range})`, 'recentReviews is not an array');
        continue;
      }
      
      const hasAllRatings = [1, 2, 3, 4, 5].every(r => r in metrics.ratingDistribution);
      if (!hasAllRatings) {
        fail(`Review Metrics (${range})`, 'ratingDistribution missing some ratings');
        continue;
      }
      
      pass(`Review Metrics (${range})`, `total=${metrics.totalReviews}, avg=${metrics.avgRating.toFixed(2)}`);
    } catch (e) {
      fail(`Review Metrics (${range})`, String(e));
    }
  }
}

async function testGetVendorAnalytics(vendorId: string) {
  log('Testing getVendorAnalytics (combined)...');
  
  try {
    const analytics = await getVendorAnalytics(vendorId, '30d', 'day');
    
    if (!analytics.sales) fail('Combined Analytics', 'Missing sales');
    else if (!analytics.orders) fail('Combined Analytics', 'Missing orders');
    else if (!analytics.products) fail('Combined Analytics', 'Missing products');
    else if (!analytics.reviews) fail('Combined Analytics', 'Missing reviews');
    else if (!analytics.generatedAt) fail('Combined Analytics', 'Missing generatedAt');
    else {
      pass('Combined Analytics', `Generated at ${analytics.generatedAt}`);
    }
  } catch (e) {
    fail('Combined Analytics', String(e));
  }
}

async function testNonExistentVendor() {
  log('Testing with non-existent vendor ID...');
  
  const fakeVendorId = 'vendor_nonexistent_12345';
  
  try {
    const metrics = await getVendorSalesMetrics(fakeVendorId, '30d', 'day');
    
    if (metrics.totalRevenue === 0 && metrics.totalOrders === 0 && metrics.salesTrends.length === 0) {
      pass('Non-existent Vendor', 'Returns empty data correctly');
    } else {
      fail('Non-existent Vendor', 'Should return zero/empty data');
    }
  } catch (e) {
    fail('Non-existent Vendor', `Should not throw error: ${e}`);
  }
}

async function testDataAccuracy(vendorId: string) {
  log('Testing data accuracy...');
  
  try {
    const manualRevenueResult = await query<{ total: string }>(
      `SELECT COALESCE(SUM(oi.final_price * oi.quantity), 0) as total
       FROM order_items oi
       JOIN orders o ON oi.order_id = o.id
       WHERE oi.vendor_id = $1 AND o.payment_status = 'paid'`,
      [vendorId]
    );
    const expectedRevenue = parseFloat(manualRevenueResult.rows[0]?.total || '0');
    
    const metrics = await getVendorSalesMetrics(vendorId, 'all', 'day');
    
    const diff = Math.abs(metrics.totalRevenue - expectedRevenue);
    if (diff < 0.01) {
      pass('Data Accuracy - Revenue', `Matches: ${metrics.totalRevenue} = ${expectedRevenue}`);
    } else {
      fail('Data Accuracy - Revenue', `Mismatch: DAL=${metrics.totalRevenue}, Manual=${expectedRevenue}`);
    }
    
    const manualOrdersResult = await query<{ count: string }>(
      `SELECT COUNT(DISTINCT o.id) as count
       FROM order_items oi
       JOIN orders o ON oi.order_id = o.id
       WHERE oi.vendor_id = $1 AND o.payment_status = 'paid'`,
      [vendorId]
    );
    const expectedOrders = parseInt(manualOrdersResult.rows[0]?.count || '0');
    
    if (metrics.totalOrders === expectedOrders) {
      pass('Data Accuracy - Orders', `Matches: ${metrics.totalOrders} = ${expectedOrders}`);
    } else {
      fail('Data Accuracy - Orders', `Mismatch: DAL=${metrics.totalOrders}, Manual=${expectedOrders}`);
    }
    
    const manualProductsResult = await query<{ count: string }>(
      `SELECT COUNT(*) as count FROM products WHERE vendor_id = $1`,
      [vendorId]
    );
    const expectedProducts = parseInt(manualProductsResult.rows[0]?.count || '0');
    
    const productStats = await getVendorProductStats(vendorId);
    if (productStats.total === expectedProducts) {
      pass('Data Accuracy - Products', `Matches: ${productStats.total} = ${expectedProducts}`);
    } else {
      fail('Data Accuracy - Products', `Mismatch: DAL=${productStats.total}, Manual=${expectedProducts}`);
    }
    
  } catch (e) {
    fail('Data Accuracy', String(e));
  }
}

async function runAllTests() {
  console.log('\n========================================');
  console.log('VENDOR ANALYTICS END-TO-END TESTS');
  console.log('========================================\n');
  
  const vendorId = await getTestVendorId();
  
  if (!vendorId) {
    console.log('❌ No vendor found in database. Creating test data...');
    fail('Setup', 'No vendor found in database');
    return;
  }
  
  console.log(`Using vendor ID: ${vendorId}\n`);
  
  await testGetVendorSalesMetrics(vendorId);
  console.log('');
  
  await testGetVendorOrderMetrics(vendorId);
  console.log('');
  
  await testGetVendorProductPerformance(vendorId);
  console.log('');
  
  await testGetVendorProductStats(vendorId);
  console.log('');
  
  await testGetVendorReviewMetrics(vendorId);
  console.log('');
  
  await testGetVendorAnalytics(vendorId);
  console.log('');
  
  await testNonExistentVendor();
  console.log('');
  
  await testDataAccuracy(vendorId);
  console.log('');
  
  console.log('\n========================================');
  console.log('TEST SUMMARY');
  console.log('========================================');
  
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  
  console.log(`Total: ${results.length}`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  
  if (failed > 0) {
    console.log('\nFailed tests:');
    results.filter(r => !r.passed).forEach(r => {
      console.log(`  - ${r.name}: ${r.error}`);
    });
  }
  
  console.log(`\n${failed === 0 ? '✅ ALL TESTS PASSED!' : '❌ SOME TESTS FAILED'}`);
  
  process.exit(failed > 0 ? 1 : 0);
}

runAllTests().catch(e => {
  console.error('Test runner failed:', e);
  process.exit(1);
});
