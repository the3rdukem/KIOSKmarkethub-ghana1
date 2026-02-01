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
          // Most popular in Ghana (top priority)
          {
            value: 'Toyota',
            children: [
              { value: 'Camry', children: [{ value: 'LE' }, { value: 'SE' }, { value: 'XLE' }, { value: 'XSE' }, { value: 'TRD' }] },
              { value: 'Corolla', children: [{ value: 'L' }, { value: 'LE' }, { value: 'SE' }, { value: 'XLE' }, { value: 'XSE' }] },
              { value: 'RAV4', children: [{ value: 'LE' }, { value: 'XLE' }, { value: 'XLE Premium' }, { value: 'Adventure' }, { value: 'Limited' }, { value: 'TRD Off-Road' }] },
              { value: 'Hilux', children: [{ value: 'Single Cab' }, { value: 'Double Cab' }, { value: 'SR' }, { value: 'SR5' }, { value: 'Workmate' }] },
              { value: 'Land Cruiser', children: [{ value: 'Standard' }, { value: 'Heritage Edition' }, { value: 'GX' }, { value: 'VX' }, { value: 'Prado' }] },
              { value: 'Highlander', children: [{ value: 'L' }, { value: 'LE' }, { value: 'XLE' }, { value: 'Limited' }, { value: 'Platinum' }] },
              { value: 'Yaris', children: [{ value: 'L' }, { value: 'LE' }, { value: 'XLE' }] },
              { value: 'Avalon', children: [{ value: 'XLE' }, { value: 'XSE' }, { value: 'Limited' }, { value: 'Touring' }] },
              { value: 'Prius', children: [{ value: 'L Eco' }, { value: 'LE' }, { value: 'XLE' }, { value: 'Limited' }] },
              { value: '4Runner', children: [{ value: 'SR5' }, { value: 'SR5 Premium' }, { value: 'TRD Off-Road' }, { value: 'Limited' }, { value: 'TRD Pro' }] },
              { value: 'Tacoma', children: [{ value: 'SR' }, { value: 'SR5' }, { value: 'TRD Sport' }, { value: 'TRD Off-Road' }, { value: 'Limited' }] },
              { value: 'Tundra', children: [{ value: 'SR' }, { value: 'SR5' }, { value: 'Limited' }, { value: '1794 Edition' }, { value: 'TRD Pro' }] },
              { value: 'Venza', children: [{ value: 'LE' }, { value: 'XLE' }, { value: 'Limited' }] },
              { value: 'Sienna', children: [{ value: 'LE' }, { value: 'XLE' }, { value: 'XSE' }, { value: 'Limited' }, { value: 'Platinum' }] },
            ],
          },
          {
            value: 'Honda',
            children: [
              { value: 'Accord', children: [{ value: 'LX' }, { value: 'Sport' }, { value: 'Sport SE' }, { value: 'EX-L' }, { value: 'Touring' }] },
              { value: 'Civic', children: [{ value: 'LX' }, { value: 'Sport' }, { value: 'EX' }, { value: 'Touring' }, { value: 'Si' }, { value: 'Type R' }] },
              { value: 'CR-V', children: [{ value: 'LX' }, { value: 'EX' }, { value: 'EX-L' }, { value: 'Touring' }] },
              { value: 'Pilot', children: [{ value: 'LX' }, { value: 'EX' }, { value: 'EX-L' }, { value: 'Touring' }, { value: 'Elite' }, { value: 'Black Edition' }] },
              { value: 'HR-V', children: [{ value: 'LX' }, { value: 'Sport' }, { value: 'EX' }, { value: 'EX-L' }] },
              { value: 'Fit', children: [{ value: 'LX' }, { value: 'Sport' }, { value: 'EX' }, { value: 'EX-L' }] },
              { value: 'Odyssey', children: [{ value: 'LX' }, { value: 'EX' }, { value: 'EX-L' }, { value: 'Touring' }, { value: 'Elite' }] },
              { value: 'Passport', children: [{ value: 'Sport' }, { value: 'EX-L' }, { value: 'Touring' }, { value: 'Elite' }] },
              { value: 'Ridgeline', children: [{ value: 'Sport' }, { value: 'RTL' }, { value: 'RTL-E' }, { value: 'Black Edition' }] },
            ],
          },
          {
            value: 'Hyundai',
            children: [
              { value: 'Elantra', children: [{ value: 'SE' }, { value: 'SEL' }, { value: 'N Line' }, { value: 'Limited' }, { value: 'N' }] },
              { value: 'Tucson', children: [{ value: 'SE' }, { value: 'SEL' }, { value: 'XRT' }, { value: 'Limited' }, { value: 'N Line' }] },
              { value: 'Sonata', children: [{ value: 'SE' }, { value: 'SEL' }, { value: 'SEL Plus' }, { value: 'Limited' }, { value: 'N Line' }] },
              { value: 'Santa Fe', children: [{ value: 'SE' }, { value: 'SEL' }, { value: 'XRT' }, { value: 'Limited' }, { value: 'Calligraphy' }] },
              { value: 'Accent', children: [{ value: 'SE' }, { value: 'SEL' }, { value: 'Limited' }] },
              { value: 'Kona', children: [{ value: 'SE' }, { value: 'SEL' }, { value: 'N Line' }, { value: 'Limited' }, { value: 'N' }] },
              { value: 'Palisade', children: [{ value: 'SE' }, { value: 'SEL' }, { value: 'Limited' }, { value: 'Calligraphy' }] },
              { value: 'Venue', children: [{ value: 'SE' }, { value: 'SEL' }, { value: 'Denim' }] },
            ],
          },
          {
            value: 'Nissan',
            children: [
              { value: 'Altima', children: [{ value: 'S' }, { value: 'SV' }, { value: 'SR' }, { value: 'SL' }, { value: 'Platinum' }] },
              { value: 'Sentra', children: [{ value: 'S' }, { value: 'SV' }, { value: 'SR' }] },
              { value: 'Rogue', children: [{ value: 'S' }, { value: 'SV' }, { value: 'SL' }, { value: 'Platinum' }] },
              { value: 'Pathfinder', children: [{ value: 'S' }, { value: 'SV' }, { value: 'SL' }, { value: 'Platinum' }] },
              { value: 'Murano', children: [{ value: 'S' }, { value: 'SV' }, { value: 'SL' }, { value: 'Platinum' }] },
              { value: 'Maxima', children: [{ value: 'SV' }, { value: 'SR' }, { value: 'SL' }, { value: 'Platinum' }] },
              { value: 'Kicks', children: [{ value: 'S' }, { value: 'SV' }, { value: 'SR' }] },
              { value: 'Armada', children: [{ value: 'S' }, { value: 'SV' }, { value: 'SL' }, { value: 'Platinum' }] },
              { value: 'Frontier', children: [{ value: 'S' }, { value: 'SV' }, { value: 'PRO-X' }, { value: 'PRO-4X' }] },
              { value: 'Titan', children: [{ value: 'S' }, { value: 'SV' }, { value: 'PRO-4X' }, { value: 'SL' }, { value: 'Platinum Reserve' }] },
            ],
          },
          {
            value: 'Mercedes-Benz',
            children: [
              { value: 'C-Class', children: [{ value: 'C 300' }, { value: 'C 300 4MATIC' }, { value: 'AMG C 43' }, { value: 'AMG C 63' }] },
              { value: 'E-Class', children: [{ value: 'E 350' }, { value: 'E 450' }, { value: 'AMG E 53' }, { value: 'AMG E 63 S' }] },
              { value: 'S-Class', children: [{ value: 'S 500' }, { value: 'S 580' }, { value: 'AMG S 63' }, { value: 'Maybach S 580' }] },
              { value: 'GLC', children: [{ value: 'GLC 300' }, { value: 'GLC 300 4MATIC' }, { value: 'AMG GLC 43' }, { value: 'AMG GLC 63' }] },
              { value: 'GLE', children: [{ value: 'GLE 350' }, { value: 'GLE 450' }, { value: 'GLE 580' }, { value: 'AMG GLE 53' }, { value: 'AMG GLE 63 S' }] },
              { value: 'GLS', children: [{ value: 'GLS 450' }, { value: 'GLS 580' }, { value: 'AMG GLS 63' }, { value: 'Maybach GLS 600' }] },
              { value: 'A-Class', children: [{ value: 'A 220' }, { value: 'A 220 4MATIC' }, { value: 'AMG A 35' }] },
              { value: 'CLA', children: [{ value: 'CLA 250' }, { value: 'CLA 250 4MATIC' }, { value: 'AMG CLA 35' }, { value: 'AMG CLA 45' }] },
              { value: 'GLA', children: [{ value: 'GLA 250' }, { value: 'GLA 250 4MATIC' }, { value: 'AMG GLA 35' }, { value: 'AMG GLA 45' }] },
              { value: 'GLB', children: [{ value: 'GLB 250' }, { value: 'GLB 250 4MATIC' }, { value: 'AMG GLB 35' }] },
              { value: 'G-Class', children: [{ value: 'G 550' }, { value: 'AMG G 63' }] },
            ],
          },
          {
            value: 'BMW',
            children: [
              { value: '3 Series', children: [{ value: '330i' }, { value: '330i xDrive' }, { value: 'M340i' }, { value: 'M340i xDrive' }] },
              { value: '5 Series', children: [{ value: '530i' }, { value: '530i xDrive' }, { value: '540i' }, { value: 'M550i xDrive' }] },
              { value: '7 Series', children: [{ value: '740i' }, { value: '760i xDrive' }, { value: 'M760e xDrive' }] },
              { value: 'X1', children: [{ value: 'sDrive28i' }, { value: 'xDrive28i' }] },
              { value: 'X3', children: [{ value: 'sDrive30i' }, { value: 'xDrive30i' }, { value: 'M40i' }, { value: 'M' }] },
              { value: 'X5', children: [{ value: 'sDrive40i' }, { value: 'xDrive40i' }, { value: 'xDrive45e' }, { value: 'M50i' }, { value: 'M' }] },
              { value: 'X7', children: [{ value: 'xDrive40i' }, { value: 'xDrive60i' }, { value: 'M60i' }] },
              { value: '4 Series', children: [{ value: '430i' }, { value: '430i xDrive' }, { value: 'M440i' }, { value: 'M440i xDrive' }] },
              { value: '2 Series', children: [{ value: '228i xDrive' }, { value: 'M235i xDrive' }] },
              { value: 'X6', children: [{ value: 'sDrive40i' }, { value: 'xDrive40i' }, { value: 'M50i' }, { value: 'M' }] },
              { value: 'iX', children: [{ value: 'xDrive50' }, { value: 'M60' }] },
              { value: 'i4', children: [{ value: 'eDrive35' }, { value: 'eDrive40' }, { value: 'M50' }] },
            ],
          },
          // Popular Korean brands
          {
            value: 'Kia',
            children: [
              { value: 'Sportage', children: [{ value: 'LX' }, { value: 'EX' }, { value: 'SX' }, { value: 'X-Line' }, { value: 'X-Pro' }] },
              { value: 'Sorento', children: [{ value: 'LX' }, { value: 'S' }, { value: 'EX' }, { value: 'SX' }, { value: 'SX Prestige' }] },
              { value: 'Forte', children: [{ value: 'FE' }, { value: 'LXS' }, { value: 'GT-Line' }, { value: 'GT' }] },
              { value: 'K5', children: [{ value: 'LXS' }, { value: 'GT-Line' }, { value: 'EX' }, { value: 'GT' }] },
              { value: 'Seltos', children: [{ value: 'LX' }, { value: 'S' }, { value: 'EX' }, { value: 'SX' }, { value: 'X-Line' }] },
              { value: 'Telluride', children: [{ value: 'LX' }, { value: 'S' }, { value: 'EX' }, { value: 'SX' }, { value: 'SX Prestige' }] },
              { value: 'Soul', children: [{ value: 'LX' }, { value: 'S' }, { value: 'GT-Line' }, { value: 'Turbo' }] },
              { value: 'Rio', children: [{ value: 'LX' }, { value: 'S' }] },
              { value: 'Carnival', children: [{ value: 'LX' }, { value: 'LXS' }, { value: 'EX' }, { value: 'SX' }, { value: 'SX Prestige' }] },
            ],
          },
          // American brands
          {
            value: 'Ford',
            children: [
              { value: 'F-150', children: [{ value: 'XL' }, { value: 'XLT' }, { value: 'Lariat' }, { value: 'King Ranch' }, { value: 'Platinum' }, { value: 'Limited' }, { value: 'Raptor' }] },
              { value: 'Escape', children: [{ value: 'S' }, { value: 'SE' }, { value: 'SEL' }, { value: 'Titanium' }] },
              { value: 'Explorer', children: [{ value: 'Base' }, { value: 'XLT' }, { value: 'Limited' }, { value: 'ST' }, { value: 'Platinum' }, { value: 'King Ranch' }] },
              { value: 'Edge', children: [{ value: 'SE' }, { value: 'SEL' }, { value: 'ST-Line' }, { value: 'Titanium' }, { value: 'ST' }] },
              { value: 'Ranger', children: [{ value: 'XL' }, { value: 'XLT' }, { value: 'Lariat' }] },
              { value: 'Mustang', children: [{ value: 'EcoBoost' }, { value: 'EcoBoost Premium' }, { value: 'GT' }, { value: 'GT Premium' }, { value: 'Mach 1' }, { value: 'Shelby GT500' }] },
              { value: 'Bronco', children: [{ value: 'Base' }, { value: 'Big Bend' }, { value: 'Black Diamond' }, { value: 'Outer Banks' }, { value: 'Badlands' }, { value: 'Wildtrak' }, { value: 'Raptor' }] },
              { value: 'Bronco Sport', children: [{ value: 'Base' }, { value: 'Big Bend' }, { value: 'Outer Banks' }, { value: 'Badlands' }, { value: 'First Edition' }] },
              { value: 'Expedition', children: [{ value: 'XL' }, { value: 'XLT' }, { value: 'Limited' }, { value: 'King Ranch' }, { value: 'Platinum' }, { value: 'Timberline' }] },
            ],
          },
          {
            value: 'Chevrolet',
            children: [
              { value: 'Silverado', children: [{ value: 'WT' }, { value: 'Custom' }, { value: 'LT' }, { value: 'RST' }, { value: 'LT Trail Boss' }, { value: 'LTZ' }, { value: 'High Country' }] },
              { value: 'Equinox', children: [{ value: 'LS' }, { value: 'LT' }, { value: 'RS' }, { value: 'Premier' }] },
              { value: 'Traverse', children: [{ value: 'LS' }, { value: 'LT' }, { value: 'RS' }, { value: 'Premier' }, { value: 'High Country' }] },
              { value: 'Tahoe', children: [{ value: 'LS' }, { value: 'LT' }, { value: 'Z71' }, { value: 'RST' }, { value: 'Premier' }, { value: 'High Country' }] },
              { value: 'Suburban', children: [{ value: 'LS' }, { value: 'LT' }, { value: 'Z71' }, { value: 'RST' }, { value: 'Premier' }, { value: 'High Country' }] },
              { value: 'Malibu', children: [{ value: 'LS' }, { value: 'RS' }, { value: 'LT' }, { value: 'Premier' }] },
              { value: 'Camaro', children: [{ value: 'LS' }, { value: 'LT' }, { value: 'LT1' }, { value: 'SS' }, { value: 'ZL1' }] },
              { value: 'Blazer', children: [{ value: 'LT' }, { value: 'RS' }, { value: 'Premier' }, { value: 'SS' }] },
              { value: 'Trailblazer', children: [{ value: 'LS' }, { value: 'LT' }, { value: 'Activ' }, { value: 'RS' }] },
              { value: 'Colorado', children: [{ value: 'WT' }, { value: 'LT' }, { value: 'Z71' }, { value: 'Trail Boss' }, { value: 'ZR2' }] },
            ],
          },
          // European luxury brands
          {
            value: 'Audi',
            children: [
              { value: 'A3', children: [{ value: 'Premium' }, { value: 'Premium Plus' }, { value: 'Prestige' }] },
              { value: 'A4', children: [{ value: 'Premium' }, { value: 'Premium Plus' }, { value: 'Prestige' }, { value: 'S Line' }] },
              { value: 'A6', children: [{ value: 'Premium' }, { value: 'Premium Plus' }, { value: 'Prestige' }] },
              { value: 'A8', children: [{ value: 'L' }, { value: 'L 60 TFSI' }] },
              { value: 'Q3', children: [{ value: 'Premium' }, { value: 'Premium Plus' }, { value: 'Prestige' }] },
              { value: 'Q5', children: [{ value: 'Premium' }, { value: 'Premium Plus' }, { value: 'Prestige' }, { value: 'S Line' }] },
              { value: 'Q7', children: [{ value: 'Premium' }, { value: 'Premium Plus' }, { value: 'Prestige' }] },
              { value: 'Q8', children: [{ value: 'Premium' }, { value: 'Premium Plus' }, { value: 'Prestige' }] },
              { value: 'e-tron', children: [{ value: 'Premium' }, { value: 'Premium Plus' }, { value: 'Prestige' }] },
              { value: 'RS 6', children: [{ value: 'Avant' }] },
              { value: 'RS 7', children: [{ value: 'Base' }] },
            ],
          },
          {
            value: 'Volkswagen',
            children: [
              { value: 'Jetta', children: [{ value: 'S' }, { value: 'Sport' }, { value: 'SE' }, { value: 'SEL' }, { value: 'GLI' }] },
              { value: 'Passat', children: [{ value: 'S' }, { value: 'SE' }, { value: 'R-Line' }, { value: 'SEL' }] },
              { value: 'Tiguan', children: [{ value: 'S' }, { value: 'SE' }, { value: 'SE R-Line' }, { value: 'SEL' }, { value: 'SEL R-Line' }] },
              { value: 'Atlas', children: [{ value: 'S' }, { value: 'SE' }, { value: 'SE w/Tech' }, { value: 'SEL' }, { value: 'SEL R-Line' }, { value: 'SEL Premium R-Line' }] },
              { value: 'Atlas Cross Sport', children: [{ value: 'S' }, { value: 'SE' }, { value: 'SE w/Tech' }, { value: 'SEL' }, { value: 'SEL R-Line' }] },
              { value: 'Golf', children: [{ value: 'TSI' }, { value: 'GTI S' }, { value: 'GTI SE' }, { value: 'GTI Autobahn' }, { value: 'R' }] },
              { value: 'Taos', children: [{ value: 'S' }, { value: 'SE' }, { value: 'SEL' }] },
              { value: 'ID.4', children: [{ value: 'Standard' }, { value: 'Pro' }, { value: 'Pro S' }, { value: 'Pro S Plus' }] },
              { value: 'Arteon', children: [{ value: 'SE' }, { value: 'SEL R-Line' }, { value: 'SEL Premium R-Line' }] },
            ],
          },
          // Japanese brands
          {
            value: 'Mazda',
            children: [
              { value: 'Mazda3', children: [{ value: '2.5 S' }, { value: '2.5 S Select' }, { value: '2.5 S Preferred' }, { value: '2.5 Turbo' }, { value: '2.5 Turbo Premium Plus' }] },
              { value: 'Mazda6', children: [{ value: 'Sport' }, { value: 'Touring' }, { value: 'Grand Touring' }, { value: 'Grand Touring Reserve' }, { value: 'Signature' }] },
              { value: 'CX-30', children: [{ value: '2.5 S' }, { value: '2.5 S Select' }, { value: '2.5 S Preferred' }, { value: '2.5 Turbo' }, { value: '2.5 Turbo Premium Plus' }] },
              { value: 'CX-5', children: [{ value: '2.5 S' }, { value: '2.5 S Select' }, { value: '2.5 S Preferred' }, { value: '2.5 S Carbon Edition' }, { value: '2.5 Turbo' }, { value: '2.5 Turbo Signature' }] },
              { value: 'CX-50', children: [{ value: '2.5 S' }, { value: '2.5 S Select' }, { value: '2.5 S Preferred' }, { value: '2.5 S Premium' }, { value: '2.5 Turbo' }, { value: '2.5 Turbo Premium Plus' }] },
              { value: 'CX-9', children: [{ value: 'Sport' }, { value: 'Touring' }, { value: 'Carbon Edition' }, { value: 'Grand Touring' }, { value: 'Signature' }] },
              { value: 'MX-5 Miata', children: [{ value: 'Sport' }, { value: 'Club' }, { value: 'Grand Touring' }] },
            ],
          },
          {
            value: 'Subaru',
            children: [
              { value: 'Outback', children: [{ value: 'Base' }, { value: 'Premium' }, { value: 'Limited' }, { value: 'Touring' }, { value: 'Onyx Edition XT' }, { value: 'Wilderness' }] },
              { value: 'Forester', children: [{ value: 'Base' }, { value: 'Premium' }, { value: 'Sport' }, { value: 'Limited' }, { value: 'Touring' }, { value: 'Wilderness' }] },
              { value: 'Crosstrek', children: [{ value: 'Base' }, { value: 'Premium' }, { value: 'Sport' }, { value: 'Limited' }] },
              { value: 'Impreza', children: [{ value: 'Base' }, { value: 'Premium' }, { value: 'Sport' }, { value: 'Limited' }] },
              { value: 'Legacy', children: [{ value: 'Base' }, { value: 'Premium' }, { value: 'Sport' }, { value: 'Limited' }, { value: 'Touring XT' }] },
              { value: 'Ascent', children: [{ value: 'Base' }, { value: 'Premium' }, { value: 'Limited' }, { value: 'Touring' }, { value: 'Onyx Edition' }] },
              { value: 'WRX', children: [{ value: 'Base' }, { value: 'Premium' }, { value: 'Limited' }, { value: 'GT' }] },
              { value: 'BRZ', children: [{ value: 'Premium' }, { value: 'Limited' }] },
              { value: 'Solterra', children: [{ value: 'Premium' }, { value: 'Limited' }, { value: 'Touring' }] },
            ],
          },
          {
            value: 'Mitsubishi',
            children: [
              { value: 'Outlander', children: [{ value: 'ES' }, { value: 'SE' }, { value: 'SEL' }, { value: 'GT' }] },
              { value: 'Outlander Sport', children: [{ value: 'ES' }, { value: 'SE' }, { value: 'GT' }] },
              { value: 'Eclipse Cross', children: [{ value: 'ES' }, { value: 'LE' }, { value: 'SE' }, { value: 'SEL' }] },
              { value: 'Mirage', children: [{ value: 'ES' }, { value: 'LE' }, { value: 'SE' }] },
              { value: 'Mirage G4', children: [{ value: 'ES' }, { value: 'LE' }, { value: 'SE' }] },
              { value: 'Pajero', children: [{ value: 'GLS' }, { value: 'GLX' }, { value: 'Exceed' }] },
              { value: 'L200', children: [{ value: 'GL' }, { value: 'GLX' }, { value: 'GLS' }] },
            ],
          },
          // Luxury brands
          {
            value: 'Lexus',
            children: [
              { value: 'ES', children: [{ value: 'ES 250' }, { value: 'ES 350' }, { value: 'ES 300h' }] },
              { value: 'IS', children: [{ value: 'IS 300' }, { value: 'IS 350' }, { value: 'IS 500' }] },
              { value: 'RX', children: [{ value: 'RX 350' }, { value: 'RX 350h' }, { value: 'RX 450h+' }, { value: 'RX 500h' }] },
              { value: 'NX', children: [{ value: 'NX 250' }, { value: 'NX 350' }, { value: 'NX 350h' }, { value: 'NX 450h+' }] },
              { value: 'GX', children: [{ value: 'GX 460' }, { value: 'GX 550' }] },
              { value: 'LX', children: [{ value: 'LX 600' }] },
              { value: 'UX', children: [{ value: 'UX 200' }, { value: 'UX 250h' }] },
              { value: 'LS', children: [{ value: 'LS 500' }, { value: 'LS 500h' }] },
              { value: 'LC', children: [{ value: 'LC 500' }, { value: 'LC 500h' }] },
              { value: 'RC', children: [{ value: 'RC 300' }, { value: 'RC 350' }, { value: 'RC F' }] },
            ],
          },
          {
            value: 'Land Rover',
            children: [
              { value: 'Range Rover', children: [{ value: 'SE' }, { value: 'HSE' }, { value: 'Autobiography' }, { value: 'SV' }] },
              { value: 'Range Rover Sport', children: [{ value: 'SE' }, { value: 'Dynamic SE' }, { value: 'Dynamic HSE' }, { value: 'Autobiography' }, { value: 'First Edition' }] },
              { value: 'Range Rover Velar', children: [{ value: 'R-Dynamic S' }, { value: 'R-Dynamic SE' }, { value: 'R-Dynamic HSE' }] },
              { value: 'Range Rover Evoque', children: [{ value: 'S' }, { value: 'SE' }, { value: 'Dynamic SE' }, { value: 'Autobiography' }] },
              { value: 'Defender', children: [{ value: '90' }, { value: '110' }, { value: '130' }, { value: 'V8' }] },
              { value: 'Discovery', children: [{ value: 'S' }, { value: 'SE' }, { value: 'Dynamic SE' }, { value: 'HSE' }, { value: 'Metropolitan Edition' }] },
              { value: 'Discovery Sport', children: [{ value: 'S' }, { value: 'SE' }, { value: 'Dynamic SE' }, { value: 'R-Dynamic SE' }] },
            ],
          },
          {
            value: 'Porsche',
            children: [
              { value: 'Cayenne', children: [{ value: 'Base' }, { value: 'E-Hybrid' }, { value: 'S' }, { value: 'GTS' }, { value: 'Turbo' }, { value: 'Turbo GT' }] },
              { value: 'Macan', children: [{ value: 'Base' }, { value: 'S' }, { value: 'GTS' }] },
              { value: '911', children: [{ value: 'Carrera' }, { value: 'Carrera S' }, { value: 'Carrera 4S' }, { value: 'Targa 4' }, { value: 'Turbo' }, { value: 'Turbo S' }, { value: 'GT3' }] },
              { value: 'Panamera', children: [{ value: 'Base' }, { value: '4' }, { value: '4 E-Hybrid' }, { value: '4S' }, { value: 'GTS' }, { value: 'Turbo S' }] },
              { value: 'Taycan', children: [{ value: 'Base' }, { value: '4S' }, { value: 'GTS' }, { value: 'Turbo' }, { value: 'Turbo S' }] },
              { value: '718 Boxster', children: [{ value: 'Base' }, { value: 'S' }, { value: 'GTS 4.0' }, { value: 'Spyder' }] },
              { value: '718 Cayman', children: [{ value: 'Base' }, { value: 'S' }, { value: 'GTS 4.0' }, { value: 'GT4' }] },
            ],
          },
          {
            value: 'Volvo',
            children: [
              { value: 'XC40', children: [{ value: 'B4' }, { value: 'B5' }, { value: 'Recharge Pure Electric' }] },
              { value: 'XC60', children: [{ value: 'B5' }, { value: 'B6' }, { value: 'T8 Recharge' }] },
              { value: 'XC90', children: [{ value: 'B5' }, { value: 'B6' }, { value: 'T8 Recharge' }] },
              { value: 'S60', children: [{ value: 'B5' }, { value: 'T8 Recharge' }] },
              { value: 'S90', children: [{ value: 'B6' }, { value: 'T8 Recharge' }] },
              { value: 'V60', children: [{ value: 'B5' }, { value: 'T8 Recharge' }] },
              { value: 'V90 Cross Country', children: [{ value: 'B6' }] },
              { value: 'C40 Recharge', children: [{ value: 'Pure Electric' }] },
            ],
          },
          // Additional popular brands
          {
            value: 'Jeep',
            children: [
              { value: 'Wrangler', children: [{ value: 'Sport' }, { value: 'Sport S' }, { value: 'Willys' }, { value: 'Sahara' }, { value: 'Rubicon' }, { value: '4xe' }] },
              { value: 'Grand Cherokee', children: [{ value: 'Laredo' }, { value: 'Limited' }, { value: 'Trailhawk' }, { value: 'Overland' }, { value: 'Summit' }, { value: 'Summit Reserve' }] },
              { value: 'Cherokee', children: [{ value: 'Latitude' }, { value: 'Latitude Lux' }, { value: 'Limited' }, { value: 'Trailhawk' }] },
              { value: 'Compass', children: [{ value: 'Sport' }, { value: 'Latitude' }, { value: 'Limited' }, { value: 'Trailhawk' }] },
              { value: 'Gladiator', children: [{ value: 'Sport' }, { value: 'Sport S' }, { value: 'Willys' }, { value: 'Overland' }, { value: 'Rubicon' }, { value: 'Mojave' }] },
              { value: 'Renegade', children: [{ value: 'Sport' }, { value: 'Latitude' }, { value: 'Limited' }, { value: 'Trailhawk' }] },
              { value: 'Grand Wagoneer', children: [{ value: 'Series I' }, { value: 'Series II' }, { value: 'Series III' }, { value: 'Obsidian' }] },
              { value: 'Wagoneer', children: [{ value: 'Series I' }, { value: 'Series II' }, { value: 'Series III' }] },
            ],
          },
          {
            value: 'Dodge',
            children: [
              { value: 'Durango', children: [{ value: 'SXT' }, { value: 'GT' }, { value: 'Citadel' }, { value: 'R/T' }, { value: 'SRT Hellcat' }] },
              { value: 'Charger', children: [{ value: 'SXT' }, { value: 'GT' }, { value: 'R/T' }, { value: 'Scat Pack' }, { value: 'SRT Hellcat' }, { value: 'SRT Hellcat Redeye' }] },
              { value: 'Challenger', children: [{ value: 'SXT' }, { value: 'GT' }, { value: 'R/T' }, { value: 'R/T Scat Pack' }, { value: 'SRT Hellcat' }, { value: 'SRT Demon' }] },
              { value: 'Hornet', children: [{ value: 'GT' }, { value: 'R/T' }] },
            ],
          },
          {
            value: 'Ram',
            children: [
              { value: '1500', children: [{ value: 'Tradesman' }, { value: 'Big Horn' }, { value: 'Laramie' }, { value: 'Rebel' }, { value: 'Limited' }, { value: 'TRX' }] },
              { value: '2500', children: [{ value: 'Tradesman' }, { value: 'Big Horn' }, { value: 'Laramie' }, { value: 'Limited' }, { value: 'Power Wagon' }] },
              { value: '3500', children: [{ value: 'Tradesman' }, { value: 'Big Horn' }, { value: 'Laramie' }, { value: 'Limited' }] },
              { value: 'ProMaster', children: [{ value: '1500' }, { value: '2500' }, { value: '3500' }] },
            ],
          },
          {
            value: 'GMC',
            children: [
              { value: 'Sierra 1500', children: [{ value: 'Pro' }, { value: 'SLE' }, { value: 'Elevation' }, { value: 'SLT' }, { value: 'AT4' }, { value: 'Denali' }] },
              { value: 'Terrain', children: [{ value: 'SLE' }, { value: 'SLT' }, { value: 'AT4' }, { value: 'Denali' }] },
              { value: 'Acadia', children: [{ value: 'SLE' }, { value: 'SLT' }, { value: 'AT4' }, { value: 'Denali' }] },
              { value: 'Yukon', children: [{ value: 'SLE' }, { value: 'SLT' }, { value: 'AT4' }, { value: 'Denali' }] },
              { value: 'Yukon XL', children: [{ value: 'SLE' }, { value: 'SLT' }, { value: 'AT4' }, { value: 'Denali' }] },
              { value: 'Canyon', children: [{ value: 'Elevation' }, { value: 'AT4' }, { value: 'Denali' }, { value: 'AT4X' }] },
              { value: 'Hummer EV', children: [{ value: 'Edition 1' }, { value: 'EV2' }, { value: 'EV2X' }, { value: 'EV3X' }] },
            ],
          },
          {
            value: 'Acura',
            children: [
              { value: 'MDX', children: [{ value: 'Base' }, { value: 'Technology' }, { value: 'A-Spec' }, { value: 'Advance' }, { value: 'Type S' }] },
              { value: 'RDX', children: [{ value: 'Base' }, { value: 'Technology' }, { value: 'A-Spec' }, { value: 'Advance' }] },
              { value: 'TLX', children: [{ value: 'Base' }, { value: 'Technology' }, { value: 'A-Spec' }, { value: 'Advance' }, { value: 'Type S' }] },
              { value: 'Integra', children: [{ value: 'Base' }, { value: 'A-Spec' }, { value: 'A-Spec Tech' }, { value: 'Type S' }] },
            ],
          },
          {
            value: 'Infiniti',
            children: [
              { value: 'Q50', children: [{ value: 'Pure' }, { value: 'Luxe' }, { value: 'Sensory' }, { value: 'Red Sport 400' }] },
              { value: 'Q60', children: [{ value: 'Pure' }, { value: 'Luxe' }, { value: 'Red Sport 400' }] },
              { value: 'QX50', children: [{ value: 'Pure' }, { value: 'Luxe' }, { value: 'Sensory' }, { value: 'Autograph' }] },
              { value: 'QX55', children: [{ value: 'Luxe' }, { value: 'Essential' }, { value: 'Sensory' }] },
              { value: 'QX60', children: [{ value: 'Pure' }, { value: 'Luxe' }, { value: 'Sensory' }, { value: 'Autograph' }] },
              { value: 'QX80', children: [{ value: 'Luxe' }, { value: 'Sensory' }, { value: 'Autograph' }] },
            ],
          },
          {
            value: 'Genesis',
            children: [
              { value: 'G70', children: [{ value: '2.0T' }, { value: '2.0T Sport' }, { value: '3.3T' }, { value: '3.3T Sport' }] },
              { value: 'G80', children: [{ value: '2.5T' }, { value: '2.5T Sport' }, { value: '3.5T' }, { value: '3.5T Sport' }, { value: 'Electrified' }] },
              { value: 'G90', children: [{ value: '3.3T' }, { value: '3.5T' }, { value: '3.5T E-Supercharger' }] },
              { value: 'GV70', children: [{ value: '2.5T' }, { value: '2.5T Sport' }, { value: '3.5T' }, { value: '3.5T Sport' }, { value: 'Electrified' }] },
              { value: 'GV80', children: [{ value: '2.5T' }, { value: '3.0T' }, { value: '3.5T' }] },
              { value: 'Electrified G80', children: [{ value: 'Standard' }, { value: 'Prestige' }] },
              { value: 'Electrified GV70', children: [{ value: 'Standard' }, { value: 'Prestige' }] },
            ],
          },
          {
            value: 'Tesla',
            children: [
              { value: 'Model 3', children: [{ value: 'Standard Range Plus' }, { value: 'Long Range' }, { value: 'Performance' }] },
              { value: 'Model Y', children: [{ value: 'Standard Range' }, { value: 'Long Range' }, { value: 'Performance' }] },
              { value: 'Model S', children: [{ value: 'Long Range' }, { value: 'Plaid' }] },
              { value: 'Model X', children: [{ value: 'Long Range' }, { value: 'Plaid' }] },
              { value: 'Cybertruck', children: [{ value: 'Single Motor' }, { value: 'Dual Motor' }, { value: 'Tri Motor' }, { value: 'Cyberbeast' }] },
            ],
          },
          {
            value: 'Peugeot',
            children: [
              { value: '208', children: [{ value: 'Active' }, { value: 'Allure' }, { value: 'GT' }, { value: 'e-208' }] },
              { value: '308', children: [{ value: 'Active' }, { value: 'Allure' }, { value: 'GT' }, { value: 'GT Sport' }] },
              { value: '508', children: [{ value: 'Active' }, { value: 'Allure' }, { value: 'GT' }, { value: 'PSE' }] },
              { value: '2008', children: [{ value: 'Active' }, { value: 'Allure' }, { value: 'GT' }, { value: 'e-2008' }] },
              { value: '3008', children: [{ value: 'Active' }, { value: 'Allure' }, { value: 'GT' }, { value: 'Hybrid' }] },
              { value: '5008', children: [{ value: 'Active' }, { value: 'Allure' }, { value: 'GT' }] },
            ],
          },
          {
            value: 'Renault',
            children: [
              { value: 'Clio', children: [{ value: 'Life' }, { value: 'Zen' }, { value: 'Intens' }, { value: 'RS Line' }] },
              { value: 'Megane', children: [{ value: 'Life' }, { value: 'Zen' }, { value: 'Intens' }, { value: 'RS' }] },
              { value: 'Captur', children: [{ value: 'Life' }, { value: 'Zen' }, { value: 'Intens' }, { value: 'RS Line' }] },
              { value: 'Kadjar', children: [{ value: 'Life' }, { value: 'Zen' }, { value: 'Intens' }] },
              { value: 'Koleos', children: [{ value: 'Life' }, { value: 'Zen' }, { value: 'Intens' }, { value: 'Initiale Paris' }] },
              { value: 'Duster', children: [{ value: 'Expression' }, { value: 'Comfort' }, { value: 'Prestige' }] },
            ],
          },
          {
            value: 'Suzuki',
            children: [
              { value: 'Swift', children: [{ value: 'GL' }, { value: 'GLX' }, { value: 'Sport' }] },
              { value: 'Vitara', children: [{ value: 'GL+' }, { value: 'GLX' }, { value: 'Turbo' }] },
              { value: 'Jimny', children: [{ value: 'GL' }, { value: 'GLX' }] },
              { value: 'S-Cross', children: [{ value: 'GL' }, { value: 'GLX' }, { value: 'Turbo' }] },
              { value: 'Baleno', children: [{ value: 'GL' }, { value: 'GLX' }] },
              { value: 'Ignis', children: [{ value: 'GL' }, { value: 'GLX' }] },
              { value: 'Ertiga', children: [{ value: 'GL' }, { value: 'GLX' }] },
            ],
          },
          {
            value: 'Isuzu',
            children: [
              { value: 'D-Max', children: [{ value: 'SX' }, { value: 'LS-M' }, { value: 'LS-U' }, { value: 'X-Terrain' }] },
              { value: 'MU-X', children: [{ value: 'LS-M' }, { value: 'LS-U' }, { value: 'LS-T' }] },
            ],
          },
          {
            value: 'Jaguar',
            children: [
              { value: 'F-PACE', children: [{ value: 'S' }, { value: 'SE' }, { value: 'HSE' }, { value: 'R-Dynamic S' }, { value: 'SVR' }] },
              { value: 'E-PACE', children: [{ value: 'S' }, { value: 'SE' }, { value: 'R-Dynamic S' }, { value: 'R-Dynamic SE' }] },
              { value: 'I-PACE', children: [{ value: 'S' }, { value: 'SE' }, { value: 'HSE' }] },
              { value: 'XF', children: [{ value: 'S' }, { value: 'SE' }, { value: 'HSE' }, { value: 'R-Dynamic S' }] },
              { value: 'F-TYPE', children: [{ value: 'P300' }, { value: 'P380' }, { value: 'R-Dynamic P380' }, { value: 'R' }] },
            ],
          },
        ],
      },
    ],
  },
  {
    categoryId: 'mobile-phones',
    fields: [
      {
        fieldKey: 'brand',
        level: 1,
        options: [
          // Most popular brands (top priority)
          {
            value: 'Apple',
            children: [
              { value: 'iPhone 15 Pro Max', children: [{ value: '256GB' }, { value: '512GB' }, { value: '1TB' }] },
              { value: 'iPhone 15 Pro', children: [{ value: '128GB' }, { value: '256GB' }, { value: '512GB' }, { value: '1TB' }] },
              { value: 'iPhone 15 Plus', children: [{ value: '128GB' }, { value: '256GB' }, { value: '512GB' }] },
              { value: 'iPhone 15', children: [{ value: '128GB' }, { value: '256GB' }, { value: '512GB' }] },
              { value: 'iPhone 14 Pro Max', children: [{ value: '128GB' }, { value: '256GB' }, { value: '512GB' }, { value: '1TB' }] },
              { value: 'iPhone 14 Pro', children: [{ value: '128GB' }, { value: '256GB' }, { value: '512GB' }, { value: '1TB' }] },
              { value: 'iPhone 14 Plus', children: [{ value: '128GB' }, { value: '256GB' }, { value: '512GB' }] },
              { value: 'iPhone 14', children: [{ value: '128GB' }, { value: '256GB' }, { value: '512GB' }] },
              { value: 'iPhone 13', children: [{ value: '128GB' }, { value: '256GB' }, { value: '512GB' }] },
              { value: 'iPhone 13 Mini', children: [{ value: '128GB' }, { value: '256GB' }, { value: '512GB' }] },
              { value: 'iPhone 12', children: [{ value: '64GB' }, { value: '128GB' }, { value: '256GB' }] },
              { value: 'iPhone 12 Mini', children: [{ value: '64GB' }, { value: '128GB' }, { value: '256GB' }] },
              { value: 'iPhone SE (3rd Gen)', children: [{ value: '64GB' }, { value: '128GB' }, { value: '256GB' }] },
              { value: 'iPhone 11', children: [{ value: '64GB' }, { value: '128GB' }, { value: '256GB' }] },
            ],
          },
          {
            value: 'Samsung',
            children: [
              { value: 'Galaxy S24 Ultra', children: [{ value: '256GB' }, { value: '512GB' }, { value: '1TB' }] },
              { value: 'Galaxy S24+', children: [{ value: '256GB' }, { value: '512GB' }] },
              { value: 'Galaxy S24', children: [{ value: '128GB' }, { value: '256GB' }] },
              { value: 'Galaxy S23 Ultra', children: [{ value: '256GB' }, { value: '512GB' }, { value: '1TB' }] },
              { value: 'Galaxy S23+', children: [{ value: '256GB' }, { value: '512GB' }] },
              { value: 'Galaxy S23', children: [{ value: '128GB' }, { value: '256GB' }] },
              { value: 'Galaxy Z Fold 5', children: [{ value: '256GB' }, { value: '512GB' }, { value: '1TB' }] },
              { value: 'Galaxy Z Flip 5', children: [{ value: '256GB' }, { value: '512GB' }] },
              { value: 'Galaxy A54 5G', children: [{ value: '128GB' }, { value: '256GB' }] },
              { value: 'Galaxy A34 5G', children: [{ value: '128GB' }, { value: '256GB' }] },
              { value: 'Galaxy A24', children: [{ value: '64GB' }, { value: '128GB' }] },
              { value: 'Galaxy A14 5G', children: [{ value: '64GB' }, { value: '128GB' }] },
              { value: 'Galaxy A04s', children: [{ value: '32GB' }, { value: '64GB' }, { value: '128GB' }] },
              { value: 'Galaxy M54 5G', children: [{ value: '128GB' }, { value: '256GB' }] },
              { value: 'Galaxy M34 5G', children: [{ value: '128GB' }, { value: '256GB' }] },
              { value: 'Galaxy Note 20 Ultra', children: [{ value: '128GB' }, { value: '256GB' }, { value: '512GB' }] },
            ],
          },
          {
            value: 'Tecno',
            children: [
              { value: 'Camon 20 Premier', children: [{ value: '256GB' }, { value: '512GB' }] },
              { value: 'Camon 20 Pro 5G', children: [{ value: '256GB' }] },
              { value: 'Camon 20 Pro', children: [{ value: '256GB' }] },
              { value: 'Camon 20', children: [{ value: '128GB' }, { value: '256GB' }] },
              { value: 'Camon 19 Pro', children: [{ value: '128GB' }, { value: '256GB' }] },
              { value: 'Phantom X2 Pro', children: [{ value: '256GB' }, { value: '512GB' }] },
              { value: 'Phantom X2', children: [{ value: '256GB' }] },
              { value: 'Phantom V Fold', children: [{ value: '256GB' }, { value: '512GB' }] },
              { value: 'Pova 5 Pro', children: [{ value: '256GB' }] },
              { value: 'Pova 5', children: [{ value: '128GB' }, { value: '256GB' }] },
              { value: 'Pova Neo 3', children: [{ value: '128GB' }] },
              { value: 'Spark 10 Pro', children: [{ value: '128GB' }, { value: '256GB' }] },
              { value: 'Spark 10', children: [{ value: '128GB' }] },
              { value: 'Spark 10C', children: [{ value: '64GB' }, { value: '128GB' }] },
              { value: 'Pop 7 Pro', children: [{ value: '64GB' }, { value: '128GB' }] },
              { value: 'Pop 7', children: [{ value: '32GB' }, { value: '64GB' }] },
            ],
          },
          {
            value: 'Infinix',
            children: [
              { value: 'Zero 30 5G', children: [{ value: '256GB' }] },
              { value: 'Zero 30', children: [{ value: '256GB' }] },
              { value: 'Note 30 VIP', children: [{ value: '256GB' }] },
              { value: 'Note 30 Pro', children: [{ value: '256GB' }] },
              { value: 'Note 30', children: [{ value: '128GB' }, { value: '256GB' }] },
              { value: 'Note 30i', children: [{ value: '128GB' }] },
              { value: 'Hot 30 Play', children: [{ value: '64GB' }, { value: '128GB' }] },
              { value: 'Hot 30', children: [{ value: '128GB' }] },
              { value: 'Hot 30i', children: [{ value: '64GB' }, { value: '128GB' }] },
              { value: 'Smart 7 HD', children: [{ value: '32GB' }, { value: '64GB' }] },
              { value: 'Smart 7', children: [{ value: '64GB' }] },
              { value: 'GT 10 Pro', children: [{ value: '256GB' }] },
            ],
          },
          {
            value: 'itel',
            children: [
              { value: 'S23+', children: [{ value: '128GB' }, { value: '256GB' }] },
              { value: 'S23', children: [{ value: '128GB' }] },
              { value: 'P40+', children: [{ value: '64GB' }, { value: '128GB' }] },
              { value: 'P40', children: [{ value: '64GB' }] },
              { value: 'A60s', children: [{ value: '32GB' }, { value: '64GB' }] },
              { value: 'A60', children: [{ value: '32GB' }] },
              { value: 'A58', children: [{ value: '32GB' }, { value: '64GB' }] },
              { value: 'A27', children: [{ value: '32GB' }] },
            ],
          },
          {
            value: 'Xiaomi',
            children: [
              { value: '14 Ultra', children: [{ value: '256GB' }, { value: '512GB' }, { value: '1TB' }] },
              { value: '14 Pro', children: [{ value: '256GB' }, { value: '512GB' }] },
              { value: '14', children: [{ value: '256GB' }, { value: '512GB' }] },
              { value: '13 Ultra', children: [{ value: '256GB' }, { value: '512GB' }] },
              { value: '13 Pro', children: [{ value: '256GB' }, { value: '512GB' }] },
              { value: '13', children: [{ value: '128GB' }, { value: '256GB' }] },
              { value: 'Redmi Note 13 Pro+', children: [{ value: '256GB' }, { value: '512GB' }] },
              { value: 'Redmi Note 13 Pro', children: [{ value: '128GB' }, { value: '256GB' }] },
              { value: 'Redmi Note 13', children: [{ value: '128GB' }, { value: '256GB' }] },
              { value: 'Redmi Note 12 Pro+', children: [{ value: '256GB' }] },
              { value: 'Redmi Note 12 Pro', children: [{ value: '128GB' }, { value: '256GB' }] },
              { value: 'Redmi Note 12', children: [{ value: '64GB' }, { value: '128GB' }] },
              { value: 'Redmi 13C', children: [{ value: '128GB' }, { value: '256GB' }] },
              { value: 'Redmi 12', children: [{ value: '128GB' }, { value: '256GB' }] },
              { value: 'Redmi A3', children: [{ value: '64GB' }, { value: '128GB' }] },
              { value: 'POCO X6 Pro', children: [{ value: '256GB' }, { value: '512GB' }] },
              { value: 'POCO X6', children: [{ value: '256GB' }] },
              { value: 'POCO M6 Pro', children: [{ value: '128GB' }, { value: '256GB' }] },
              { value: 'POCO C65', children: [{ value: '128GB' }, { value: '256GB' }] },
            ],
          },
          {
            value: 'OPPO',
            children: [
              { value: 'Find X7 Ultra', children: [{ value: '256GB' }, { value: '512GB' }] },
              { value: 'Find X7', children: [{ value: '256GB' }, { value: '512GB' }] },
              { value: 'Find N3', children: [{ value: '256GB' }, { value: '512GB' }] },
              { value: 'Reno 11 Pro', children: [{ value: '256GB' }, { value: '512GB' }] },
              { value: 'Reno 11', children: [{ value: '256GB' }] },
              { value: 'Reno 10 Pro+', children: [{ value: '256GB' }] },
              { value: 'Reno 10 Pro', children: [{ value: '256GB' }] },
              { value: 'Reno 10', children: [{ value: '128GB' }, { value: '256GB' }] },
              { value: 'A98 5G', children: [{ value: '256GB' }] },
              { value: 'A78 5G', children: [{ value: '128GB' }] },
              { value: 'A58', children: [{ value: '128GB' }] },
              { value: 'A38', children: [{ value: '128GB' }] },
              { value: 'A18', children: [{ value: '64GB' }, { value: '128GB' }] },
            ],
          },
          {
            value: 'Vivo',
            children: [
              { value: 'X100 Pro', children: [{ value: '256GB' }, { value: '512GB' }] },
              { value: 'X100', children: [{ value: '256GB' }, { value: '512GB' }] },
              { value: 'X90 Pro', children: [{ value: '256GB' }, { value: '512GB' }] },
              { value: 'X Fold 3 Pro', children: [{ value: '256GB' }, { value: '512GB' }] },
              { value: 'V30 Pro', children: [{ value: '256GB' }] },
              { value: 'V30', children: [{ value: '128GB' }, { value: '256GB' }] },
              { value: 'V29 Pro', children: [{ value: '256GB' }] },
              { value: 'V29', children: [{ value: '128GB' }, { value: '256GB' }] },
              { value: 'Y100', children: [{ value: '128GB' }, { value: '256GB' }] },
              { value: 'Y36', children: [{ value: '128GB' }, { value: '256GB' }] },
              { value: 'Y27', children: [{ value: '128GB' }] },
              { value: 'Y17s', children: [{ value: '64GB' }, { value: '128GB' }] },
            ],
          },
          {
            value: 'Realme',
            children: [
              { value: 'GT 5 Pro', children: [{ value: '256GB' }, { value: '512GB' }] },
              { value: 'GT 5', children: [{ value: '256GB' }, { value: '512GB' }] },
              { value: 'GT Neo 5', children: [{ value: '256GB' }] },
              { value: '12 Pro+', children: [{ value: '256GB' }, { value: '512GB' }] },
              { value: '12 Pro', children: [{ value: '256GB' }] },
              { value: '12', children: [{ value: '128GB' }, { value: '256GB' }] },
              { value: '11 Pro+', children: [{ value: '256GB' }] },
              { value: '11 Pro', children: [{ value: '128GB' }, { value: '256GB' }] },
              { value: 'C67', children: [{ value: '128GB' }, { value: '256GB' }] },
              { value: 'C55', children: [{ value: '64GB' }, { value: '128GB' }] },
              { value: 'C53', children: [{ value: '64GB' }, { value: '128GB' }] },
              { value: 'Narzo 60 Pro', children: [{ value: '256GB' }] },
              { value: 'Narzo 60', children: [{ value: '128GB' }, { value: '256GB' }] },
            ],
          },
          {
            value: 'Google',
            children: [
              { value: 'Pixel 8 Pro', children: [{ value: '128GB' }, { value: '256GB' }, { value: '512GB' }, { value: '1TB' }] },
              { value: 'Pixel 8', children: [{ value: '128GB' }, { value: '256GB' }] },
              { value: 'Pixel 8a', children: [{ value: '128GB' }, { value: '256GB' }] },
              { value: 'Pixel 7 Pro', children: [{ value: '128GB' }, { value: '256GB' }, { value: '512GB' }] },
              { value: 'Pixel 7', children: [{ value: '128GB' }, { value: '256GB' }] },
              { value: 'Pixel 7a', children: [{ value: '128GB' }] },
              { value: 'Pixel Fold', children: [{ value: '256GB' }, { value: '512GB' }] },
              { value: 'Pixel 6a', children: [{ value: '128GB' }] },
            ],
          },
          {
            value: 'OnePlus',
            children: [
              { value: '12', children: [{ value: '256GB' }, { value: '512GB' }] },
              { value: '12R', children: [{ value: '128GB' }, { value: '256GB' }] },
              { value: 'Open', children: [{ value: '512GB' }] },
              { value: '11', children: [{ value: '128GB' }, { value: '256GB' }] },
              { value: '11R', children: [{ value: '128GB' }, { value: '256GB' }] },
              { value: 'Nord 3', children: [{ value: '128GB' }, { value: '256GB' }] },
              { value: 'Nord CE 3', children: [{ value: '128GB' }, { value: '256GB' }] },
              { value: 'Nord N30', children: [{ value: '128GB' }] },
              { value: 'Ace 3', children: [{ value: '256GB' }, { value: '512GB' }] },
            ],
          },
          {
            value: 'Huawei',
            children: [
              { value: 'Mate 60 Pro', children: [{ value: '256GB' }, { value: '512GB' }, { value: '1TB' }] },
              { value: 'Mate 60', children: [{ value: '256GB' }, { value: '512GB' }] },
              { value: 'P60 Pro', children: [{ value: '256GB' }, { value: '512GB' }] },
              { value: 'P60', children: [{ value: '128GB' }, { value: '256GB' }] },
              { value: 'Mate X5', children: [{ value: '256GB' }, { value: '512GB' }] },
              { value: 'Nova 12 Ultra', children: [{ value: '256GB' }, { value: '512GB' }] },
              { value: 'Nova 12 Pro', children: [{ value: '256GB' }] },
              { value: 'Nova 12', children: [{ value: '256GB' }] },
              { value: 'Nova 11 Pro', children: [{ value: '256GB' }] },
              { value: 'Nova 11', children: [{ value: '128GB' }, { value: '256GB' }] },
              { value: 'Nova Y91', children: [{ value: '128GB' }, { value: '256GB' }] },
              { value: 'Nova Y71', children: [{ value: '128GB' }] },
            ],
          },
          {
            value: 'Motorola',
            children: [
              { value: 'Edge 40 Pro', children: [{ value: '256GB' }, { value: '512GB' }] },
              { value: 'Edge 40', children: [{ value: '256GB' }] },
              { value: 'Edge 40 Neo', children: [{ value: '256GB' }] },
              { value: 'Razr 40 Ultra', children: [{ value: '256GB' }] },
              { value: 'Razr 40', children: [{ value: '256GB' }] },
              { value: 'Moto G84', children: [{ value: '256GB' }] },
              { value: 'Moto G54', children: [{ value: '128GB' }, { value: '256GB' }] },
              { value: 'Moto G34', children: [{ value: '128GB' }] },
              { value: 'Moto G24', children: [{ value: '128GB' }] },
              { value: 'Moto G Power', children: [{ value: '64GB' }, { value: '128GB' }] },
              { value: 'Moto G Stylus', children: [{ value: '128GB' }] },
              { value: 'Moto E14', children: [{ value: '64GB' }] },
            ],
          },
          {
            value: 'Nokia',
            children: [
              { value: 'XR21', children: [{ value: '128GB' }] },
              { value: 'X30', children: [{ value: '128GB' }, { value: '256GB' }] },
              { value: 'G42', children: [{ value: '128GB' }, { value: '256GB' }] },
              { value: 'G22', children: [{ value: '64GB' }, { value: '128GB' }] },
              { value: 'C32', children: [{ value: '64GB' }, { value: '128GB' }] },
              { value: 'C22', children: [{ value: '32GB' }, { value: '64GB' }] },
              { value: 'C12', children: [{ value: '32GB' }, { value: '64GB' }] },
              { value: '105', children: [{ value: '4MB' }] },
            ],
          },
          {
            value: 'Sony',
            children: [
              { value: 'Xperia 1 V', children: [{ value: '256GB' }, { value: '512GB' }] },
              { value: 'Xperia 5 V', children: [{ value: '128GB' }, { value: '256GB' }] },
              { value: 'Xperia 10 V', children: [{ value: '128GB' }] },
              { value: 'Xperia 1 IV', children: [{ value: '256GB' }, { value: '512GB' }] },
              { value: 'Xperia 5 IV', children: [{ value: '128GB' }, { value: '256GB' }] },
              { value: 'Xperia 10 IV', children: [{ value: '128GB' }] },
            ],
          },
          {
            value: 'ZTE',
            children: [
              { value: 'nubia Z60 Ultra', children: [{ value: '256GB' }, { value: '512GB' }, { value: '1TB' }] },
              { value: 'nubia Z50S Pro', children: [{ value: '256GB' }, { value: '512GB' }] },
              { value: 'nubia Flip', children: [{ value: '256GB' }] },
              { value: 'Blade V50', children: [{ value: '128GB' }, { value: '256GB' }] },
              { value: 'Blade A73', children: [{ value: '128GB' }] },
              { value: 'Blade A54', children: [{ value: '64GB' }, { value: '128GB' }] },
              { value: 'Blade A34', children: [{ value: '64GB' }] },
            ],
          },
          {
            value: 'Honor',
            children: [
              { value: 'Magic 6 Pro', children: [{ value: '256GB' }, { value: '512GB' }] },
              { value: 'Magic 6', children: [{ value: '256GB' }, { value: '512GB' }] },
              { value: 'Magic V2', children: [{ value: '256GB' }, { value: '512GB' }] },
              { value: 'Magic 5 Pro', children: [{ value: '256GB' }, { value: '512GB' }] },
              { value: '90', children: [{ value: '256GB' }, { value: '512GB' }] },
              { value: 'X9b', children: [{ value: '256GB' }] },
              { value: 'X8b', children: [{ value: '256GB' }] },
              { value: 'X7b', children: [{ value: '128GB' }, { value: '256GB' }] },
              { value: 'X6a', children: [{ value: '128GB' }] },
              { value: 'X5 Plus', children: [{ value: '64GB' }] },
            ],
          },
          {
            value: 'Nothing',
            children: [
              { value: 'Phone (2)', children: [{ value: '128GB' }, { value: '256GB' }, { value: '512GB' }] },
              { value: 'Phone (1)', children: [{ value: '128GB' }, { value: '256GB' }] },
              { value: 'Phone (2a)', children: [{ value: '128GB' }, { value: '256GB' }] },
            ],
          },
          {
            value: 'ASUS',
            children: [
              { value: 'ROG Phone 8 Pro', children: [{ value: '256GB' }, { value: '512GB' }] },
              { value: 'ROG Phone 8', children: [{ value: '256GB' }, { value: '512GB' }] },
              { value: 'Zenfone 11 Ultra', children: [{ value: '256GB' }, { value: '512GB' }] },
              { value: 'Zenfone 10', children: [{ value: '128GB' }, { value: '256GB' }, { value: '512GB' }] },
              { value: 'ROG Phone 7 Ultimate', children: [{ value: '512GB' }] },
              { value: 'ROG Phone 7', children: [{ value: '256GB' }, { value: '512GB' }] },
            ],
          },
          {
            value: 'BlackBerry',
            children: [
              { value: 'KEY2', children: [{ value: '64GB' }, { value: '128GB' }] },
              { value: 'KEY2 LE', children: [{ value: '32GB' }, { value: '64GB' }] },
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
