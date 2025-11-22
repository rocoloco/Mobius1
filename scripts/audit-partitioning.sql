-- Audit Event Partitioning and Indexing Strategy
-- This script sets up partitioning and optimized indexing for audit events
-- to support high-volume audit logging with efficient querying

-- Enable the pg_partman extension for automated partition management
CREATE EXTENSION IF NOT EXISTS pg_partman;

-- Create partitioned audit_events table (if not already partitioned)
-- This will partition by month for optimal performance and maintenance

-- First, check if the table is already partitioned
DO $$
BEGIN
    -- Check if audit_events is already partitioned
    IF NOT EXISTS (
        SELECT 1 FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relname = 'audit_events' 
        AND c.relkind = 'p'  -- 'p' indicates partitioned table
        AND n.nspname = 'public'
    ) THEN
        -- If not partitioned, we need to convert it
        -- This is a complex operation that should be done during maintenance
        RAISE NOTICE 'audit_events table is not partitioned. Manual conversion required during maintenance window.';
    END IF;
END $$;

-- Create optimized indexes for audit event queries
-- These indexes support the most common query patterns

-- Index for workspace-scoped queries (most common)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_events_workspace_timestamp 
ON audit_events (workspace_id, timestamp DESC);

-- Index for event type filtering
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_events_event_type_timestamp 
ON audit_events (event_type, timestamp DESC);

-- Index for correlation ID tracing (exact match)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_events_correlation_id 
ON audit_events (correlation_id);

-- Index for user-specific queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_events_user_timestamp 
ON audit_events (user_id, timestamp DESC) 
WHERE user_id IS NOT NULL;

-- Index for resource-specific queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_events_resource_timestamp 
ON audit_events (resource_id, timestamp DESC);

-- Composite index for complex filtering
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_events_workspace_type_timestamp 
ON audit_events (workspace_id, event_type, timestamp DESC);

-- Partial index for policy violations (high-priority events)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_events_violations 
ON audit_events (workspace_id, timestamp DESC) 
WHERE event_type IN ('POLICY_VIOLATION', 'RESIDENCY_VIOLATION', 'PROMPT_INJECTION_ATTEMPT', 'UNAUTHORIZED_ACCESS');

-- Index for PII redaction tracking
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_events_pii_redacted 
ON audit_events (workspace_id, timestamp DESC) 
WHERE pii_redacted = true;

-- GIN index for metadata JSONB queries (if using PostgreSQL JSONB)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_events_metadata_gin 
ON audit_events USING GIN (metadata);

-- Create a function to automatically create monthly partitions
CREATE OR REPLACE FUNCTION create_audit_events_partition(partition_date DATE)
RETURNS VOID AS $$
DECLARE
    partition_name TEXT;
    start_date DATE;
    end_date DATE;
BEGIN
    -- Calculate partition boundaries
    start_date := DATE_TRUNC('month', partition_date);
    end_date := start_date + INTERVAL '1 month';
    partition_name := 'audit_events_' || TO_CHAR(start_date, 'YYYY_MM');
    
    -- Create partition if it doesn't exist
    EXECUTE format('
        CREATE TABLE IF NOT EXISTS %I PARTITION OF audit_events
        FOR VALUES FROM (%L) TO (%L)',
        partition_name, start_date, end_date
    );
    
    -- Create indexes on the partition
    EXECUTE format('
        CREATE INDEX IF NOT EXISTS %I ON %I (workspace_id, timestamp DESC)',
        partition_name || '_workspace_timestamp', partition_name
    );
    
    EXECUTE format('
        CREATE INDEX IF NOT EXISTS %I ON %I (correlation_id)',
        partition_name || '_correlation_id', partition_name
    );
    
    RAISE NOTICE 'Created partition % for period % to %', partition_name, start_date, end_date;
END;
$$ LANGUAGE plpgsql;

-- Create partitions for the current month and next 3 months
DO $$
DECLARE
    i INTEGER;
    partition_date DATE;
BEGIN
    FOR i IN 0..3 LOOP
        partition_date := DATE_TRUNC('month', CURRENT_DATE) + (i || ' months')::INTERVAL;
        PERFORM create_audit_events_partition(partition_date);
    END LOOP;
END $$;

-- Create a function to clean up old partitions based on retention policy
CREATE OR REPLACE FUNCTION cleanup_old_audit_partitions(retention_months INTEGER DEFAULT 84) -- 7 years default
RETURNS INTEGER AS $$
DECLARE
    partition_record RECORD;
    partition_date DATE;
    cutoff_date DATE;
    dropped_count INTEGER := 0;
BEGIN
    cutoff_date := DATE_TRUNC('month', CURRENT_DATE) - (retention_months || ' months')::INTERVAL;
    
    -- Find and drop old partitions
    FOR partition_record IN
        SELECT schemaname, tablename 
        FROM pg_tables 
        WHERE tablename LIKE 'audit_events_%'
        AND schemaname = 'public'
    LOOP
        -- Extract date from partition name (format: audit_events_YYYY_MM)
        BEGIN
            partition_date := TO_DATE(
                SUBSTRING(partition_record.tablename FROM 'audit_events_(\d{4}_\d{2})'),
                'YYYY_MM'
            );
            
            IF partition_date < cutoff_date THEN
                EXECUTE format('DROP TABLE IF EXISTS %I.%I', 
                    partition_record.schemaname, partition_record.tablename);
                dropped_count := dropped_count + 1;
                RAISE NOTICE 'Dropped old partition: %', partition_record.tablename;
            END IF;
        EXCEPTION
            WHEN OTHERS THEN
                RAISE WARNING 'Could not process partition %: %', partition_record.tablename, SQLERRM;
        END;
    END LOOP;
    
    RETURN dropped_count;
END;
$$ LANGUAGE plpgsql;

-- Create a scheduled job to create future partitions (requires pg_cron extension)
-- This is optional and depends on having pg_cron installed
DO $$
BEGIN
    -- Check if pg_cron is available
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
        -- Schedule monthly partition creation (1st of each month at 2 AM)
        PERFORM cron.schedule(
            'create-audit-partitions',
            '0 2 1 * *',
            'SELECT create_audit_events_partition(CURRENT_DATE + INTERVAL ''2 months'');'
        );
        
        -- Schedule quarterly cleanup (1st of January, April, July, October at 3 AM)
        PERFORM cron.schedule(
            'cleanup-audit-partitions',
            '0 3 1 1,4,7,10 *',
            'SELECT cleanup_old_audit_partitions();'
        );
        
        RAISE NOTICE 'Scheduled automatic partition management jobs';
    ELSE
        RAISE NOTICE 'pg_cron extension not available. Manual partition management required.';
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Could not schedule partition management jobs: %', SQLERRM;
END $$;

-- Create a view for audit event statistics
CREATE OR REPLACE VIEW audit_event_statistics AS
SELECT 
    workspace_id,
    event_type,
    DATE_TRUNC('day', timestamp) as event_date,
    COUNT(*) as event_count,
    COUNT(CASE WHEN event_type IN ('POLICY_VIOLATION', 'RESIDENCY_VIOLATION', 'PROMPT_INJECTION_ATTEMPT') THEN 1 END) as violation_count,
    COUNT(CASE WHEN pii_redacted = true THEN 1 END) as pii_redaction_count
FROM audit_events
WHERE timestamp >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY workspace_id, event_type, DATE_TRUNC('day', timestamp)
ORDER BY event_date DESC, workspace_id, event_type;

-- Create a function to get audit trail integrity hash
CREATE OR REPLACE FUNCTION get_audit_trail_hash(
    p_workspace_id UUID,
    p_start_date TIMESTAMP,
    p_end_date TIMESTAMP
) RETURNS TEXT AS $$
DECLARE
    trail_hash TEXT;
BEGIN
    -- Create a deterministic hash of the audit trail for integrity verification
    SELECT encode(
        digest(
            string_agg(
                id::TEXT || timestamp::TEXT || event_type || resource_id || action,
                '' ORDER BY timestamp, id
            ),
            'sha256'
        ),
        'hex'
    ) INTO trail_hash
    FROM audit_events
    WHERE workspace_id = p_workspace_id
    AND timestamp BETWEEN p_start_date AND p_end_date;
    
    RETURN COALESCE(trail_hash, '');
END;
$$ LANGUAGE plpgsql;

-- Grant appropriate permissions
GRANT SELECT ON audit_event_statistics TO PUBLIC;
GRANT EXECUTE ON FUNCTION get_audit_trail_hash(UUID, TIMESTAMP, TIMESTAMP) TO PUBLIC;

-- Create a trigger to automatically update correlation_id if not provided
CREATE OR REPLACE FUNCTION ensure_correlation_id()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.correlation_id IS NULL OR NEW.correlation_id = '' THEN
        NEW.correlation_id := gen_random_uuid()::TEXT;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_ensure_correlation_id
    BEFORE INSERT ON audit_events
    FOR EACH ROW
    EXECUTE FUNCTION ensure_correlation_id();

-- Performance monitoring view
CREATE OR REPLACE VIEW audit_performance_metrics AS
SELECT 
    DATE_TRUNC('hour', timestamp) as hour,
    COUNT(*) as events_per_hour,
    AVG(EXTRACT(EPOCH FROM (timestamp - LAG(timestamp) OVER (ORDER BY timestamp)))) as avg_interval_seconds,
    COUNT(DISTINCT workspace_id) as active_workspaces,
    COUNT(DISTINCT correlation_id) as unique_operations
FROM audit_events
WHERE timestamp >= CURRENT_TIMESTAMP - INTERVAL '24 hours'
GROUP BY DATE_TRUNC('hour', timestamp)
ORDER BY hour DESC;

GRANT SELECT ON audit_performance_metrics TO PUBLIC;

-- Add comments for documentation
COMMENT ON TABLE audit_events IS 'Comprehensive audit trail for all system operations with monthly partitioning';
COMMENT ON FUNCTION create_audit_events_partition(DATE) IS 'Creates a new monthly partition for audit events';
COMMENT ON FUNCTION cleanup_old_audit_partitions(INTEGER) IS 'Removes audit partitions older than retention period';
COMMENT ON FUNCTION get_audit_trail_hash(UUID, TIMESTAMP, TIMESTAMP) IS 'Generates integrity hash for audit trail verification';
COMMENT ON VIEW audit_event_statistics IS 'Daily statistics for audit events by workspace and type';
COMMENT ON VIEW audit_performance_metrics IS 'Hourly performance metrics for audit system monitoring';

-- Final status report
DO $$
DECLARE
    partition_count INTEGER;
    index_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO partition_count
    FROM pg_tables 
    WHERE tablename LIKE 'audit_events_%' AND schemaname = 'public';
    
    SELECT COUNT(*) INTO index_count
    FROM pg_indexes 
    WHERE tablename = 'audit_events' AND schemaname = 'public';
    
    RAISE NOTICE 'Audit partitioning setup complete:';
    RAISE NOTICE '  - Partitions created: %', partition_count;
    RAISE NOTICE '  - Indexes created: %', index_count;
    RAISE NOTICE '  - Views created: 2 (audit_event_statistics, audit_performance_metrics)';
    RAISE NOTICE '  - Functions created: 4 (partition management and integrity)';
END $$;