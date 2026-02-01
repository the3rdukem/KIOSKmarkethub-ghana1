import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { cookies } from 'next/headers';
function generateOptionId(): string {
  return 'opt_' + Math.random().toString(36).substr(2, 16);
}

async function getAdminSession(sessionToken: string) {
  const pool = getPool();
  const result = await pool.query(
    `SELECT a.* FROM admin_users a
     JOIN sessions s ON s.user_id = a.id AND s.user_type = 'admin'
     WHERE s.session_token = $1 AND s.expires_at > NOW()`,
    [sessionToken]
  );
  return result.rows[0] || null;
}

interface SeedData {
  categoryId: string;
  fields: Array<{
    fieldKey: string;
    level: number;
    parentFieldKey?: string;
    options: Array<{
      value: string;
      children?: Array<{
        value: string;
        children?: Array<{ value: string }>;
      }>;
    }>;
  }>;
}

const SAMPLE_SEED_DATA: SeedData[] = [
  {
    categoryId: 'vehicles',
    fields: [
      {
        fieldKey: 'make',
        level: 1,
        options: [
          {
            value: 'Toyota',
            children: [
              { value: 'Camry', children: [{ value: 'LE' }, { value: 'SE' }, { value: 'XLE' }] },
              { value: 'Corolla', children: [{ value: 'L' }, { value: 'LE' }, { value: 'SE' }] },
              { value: 'RAV4', children: [{ value: 'LE' }, { value: 'XLE' }, { value: 'Limited' }] },
            ],
          },
          {
            value: 'Honda',
            children: [
              { value: 'Accord', children: [{ value: 'LX' }, { value: 'Sport' }, { value: 'EX' }] },
              { value: 'Civic', children: [{ value: 'LX' }, { value: 'Sport' }, { value: 'Touring' }] },
              { value: 'CR-V', children: [{ value: 'LX' }, { value: 'EX' }, { value: 'Touring' }] },
            ],
          },
          {
            value: 'Hyundai',
            children: [
              { value: 'Elantra', children: [{ value: 'SE' }, { value: 'SEL' }, { value: 'Limited' }] },
              { value: 'Tucson', children: [{ value: 'SE' }, { value: 'SEL' }, { value: 'Limited' }] },
              { value: 'Sonata', children: [{ value: 'SE' }, { value: 'SEL' }, { value: 'Limited' }] },
            ],
          },
        ],
      },
    ],
  },
];

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session_token')?.value;
    
    if (!sessionToken) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    
    const admin = await getAdminSession(sessionToken);
    if (!admin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }
    
    const body = await request.json().catch(() => ({}));
    const categoryId = body.categoryId;
    const useDefaults = body.useDefaults !== false;
    
    const pool = getPool();
    let seededCount = 0;
    
    if (useDefaults) {
      for (const seedData of SAMPLE_SEED_DATA) {
        const categoryResult = await pool.query(
          'SELECT id FROM categories WHERE slug = $1 OR id = $1',
          [seedData.categoryId]
        );
        
        if (categoryResult.rows.length === 0) continue;
        const catId = categoryResult.rows[0].id;
        
        for (const fieldDef of seedData.fields) {
          for (const option of fieldDef.options) {
            const optionId = generateOptionId();
            await pool.query(
              `INSERT INTO attribute_options (id, category_id, field_key, value, level, display_order)
               VALUES ($1, $2, $3, $4, $5, $6)
               ON CONFLICT DO NOTHING`,
              [optionId, catId, fieldDef.fieldKey, option.value, 1, seededCount++]
            );
            
            if (option.children) {
              for (const child of option.children) {
                const childId = generateOptionId();
                await pool.query(
                  `INSERT INTO attribute_options (id, category_id, field_key, value, parent_option_id, level, display_order)
                   VALUES ($1, $2, $3, $4, $5, $6, $7)
                   ON CONFLICT DO NOTHING`,
                  [childId, catId, 'model', child.value, optionId, 2, seededCount++]
                );
                
                if (child.children) {
                  for (const grandchild of child.children) {
                    const grandchildId = generateOptionId();
                    await pool.query(
                      `INSERT INTO attribute_options (id, category_id, field_key, value, parent_option_id, level, display_order)
                       VALUES ($1, $2, $3, $4, $5, $6, $7)
                       ON CONFLICT DO NOTHING`,
                      [grandchildId, catId, 'trim', grandchild.value, childId, 3, seededCount++]
                    );
                  }
                }
              }
            }
          }
        }
      }
    }
    
    return NextResponse.json({
      success: true,
      message: `Seeded ${seededCount} attribute options`,
      seededCount,
    });
  } catch (error) {
    console.error('Seed error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Seed failed' },
      { status: 500 }
    );
  }
}
