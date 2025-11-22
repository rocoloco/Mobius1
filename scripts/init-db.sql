-- Initialize Mobius 1 Database
-- This script sets up the initial database configuration

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create audit schema for compliance
CREATE SCHEMA IF NOT EXISTS audit;

-- Set timezone to Europe/Madrid for Spain residency compliance
SET timezone = 'Europe/Madrid';

-- Create initial database user roles
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'mobius_app') THEN
        CREATE ROLE mobius_app WITH LOGIN PASSWORD 'mobius_app_dev';
    END IF;
END
$$;

-- Grant necessary permissions
GRANT CONNECT ON DATABASE mobius1v3 TO mobius_app;
GRANT USAGE ON SCHEMA public TO mobius_app;
GRANT USAGE ON SCHEMA audit TO mobius_app;

-- Create function for updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';