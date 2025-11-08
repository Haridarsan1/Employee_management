/*
  # Enhance Attendance Location Tracking

  ## Changes
  1. Add location address and validation fields to attendance_records
  2. Add office locations table for geofencing
  3. Add location accuracy and device info tracking

  ## New Fields
  - check_in_address: Full address from reverse geocoding
  - check_out_address: Full address for checkout
  - check_in_accuracy: GPS accuracy in meters
  - check_out_accuracy: GPS accuracy in meters
  - is_within_office_radius: Boolean flag for geofence validation
  - device_info: Device details (browser, OS, etc.)
*/

-- Add new columns to attendance_records
ALTER TABLE attendance_records 
ADD COLUMN IF NOT EXISTS check_in_address TEXT,
ADD COLUMN IF NOT EXISTS check_out_address TEXT,
ADD COLUMN IF NOT EXISTS check_in_accuracy NUMERIC,
ADD COLUMN IF NOT EXISTS check_out_accuracy NUMERIC,
ADD COLUMN IF NOT EXISTS is_within_office_radius BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS device_info JSONB;

-- Create office_locations table for geofencing
CREATE TABLE IF NOT EXISTS office_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
  location_name TEXT NOT NULL,
  address TEXT NOT NULL,
  latitude NUMERIC(10, 8) NOT NULL,
  longitude NUMERIC(11, 8) NOT NULL,
  radius_meters INTEGER DEFAULT 100,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE office_locations ENABLE ROW LEVEL SECURITY;

-- Add policy for office locations
CREATE POLICY "Allow authenticated access" 
  ON office_locations FOR ALL 
  TO authenticated 
  USING (true) 
  WITH CHECK (true);

-- Create index for location queries
CREATE INDEX IF NOT EXISTS idx_office_locations_org 
  ON office_locations(organization_id);
