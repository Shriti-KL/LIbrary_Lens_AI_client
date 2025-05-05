// Script to update database schema
import pkg from 'pg';
const { Pool } = pkg;

async function updateSchema() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  
  try {
    console.log('Starting schema update...');
    
    // Add missing columns to books table
    const alterBookTable = `
      ALTER TABLE books 
      ADD COLUMN IF NOT EXISTS dimensions TEXT,
      ADD COLUMN IF NOT EXISTS edition TEXT,
      ADD COLUMN IF NOT EXISTS language TEXT,
      ADD COLUMN IF NOT EXISTS location TEXT,
      ADD COLUMN IF NOT EXISTS binding TEXT,
      ADD COLUMN IF NOT EXISTS price TEXT,
      ADD COLUMN IF NOT EXISTS series TEXT,
      ADD COLUMN IF NOT EXISTS contributors JSONB DEFAULT '[]'
    `;
    
    await pool.query(alterBookTable);
    console.log('✅ Successfully updated books table');
    
    // Verify all columns exist
    const checkColumns = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'books'
      ORDER BY column_name
    `);
    
    console.log('Current books table columns:');
    checkColumns.rows.forEach(row => {
      console.log(`- ${row.column_name}`);
    });
    
    console.log('Schema update completed successfully.');
  } catch (error) {
    console.error('Error updating schema:', error);
  } finally {
    await pool.end();
  }
}

updateSchema();