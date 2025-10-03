#!/bin/bash
# DC Agent Infrastructure Setup Script
# This script initializes all infrastructure services and databases

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Docker is running
check_docker() {
    print_status "Checking Docker availability..."
    if ! docker info > /dev/null 2>&1; then
        print_error "Docker is not running. Please start Docker and try again."
        exit 1
    fi
    print_success "Docker is running"
}

# Check if required files exist
check_files() {
    print_status "Checking required files..."
    
    if [ ! -f "docker-compose.yml" ]; then
        print_error "docker-compose.yml not found in current directory"
        exit 1
    fi
    
    if [ ! -f ".env.example" ]; then
        print_warning ".env.example not found, creating from template..."
        cp .env.example .env
    fi
    
    if [ ! -f ".env" ]; then
        print_status "Creating .env file from .env.example..."
        cp .env.example .env
        print_warning "Please review and update .env file with your specific configuration"
    fi
    
    print_success "Required files are present"
}

# Create necessary directories
create_directories() {
    print_status "Creating necessary directories..."
    
    mkdir -p init-scripts
    mkdir -p n8n/workflows
    mkdir -p data/neo4j
    mkdir -p data/chroma
    mkdir -p data/postgres
    mkdir -p data/redis
    mkdir -p data/minio
    mkdir -p data/n8n
    
    print_success "Directories created"
}

# Start infrastructure services
start_services() {
    print_status "Starting infrastructure services..."
    
    # Pull latest images
    print_status "Pulling latest Docker images..."
    docker-compose pull
    
    # Start services
    print_status "Starting Docker containers..."
    docker-compose up -d
    
    print_success "Infrastructure services started"
}

# Wait for services to be ready
wait_for_services() {
    print_status "Waiting for services to be ready..."
    
    # Wait for PostgreSQL
    print_status "Waiting for PostgreSQL..."
    timeout=60
    while ! docker-compose exec -T postgres pg_isready -U dc_agent -d dc_agent > /dev/null 2>&1; do
        sleep 2
        timeout=$((timeout - 2))
        if [ $timeout -le 0 ]; then
            print_error "PostgreSQL failed to start within 60 seconds"
            exit 1
        fi
    done
    print_success "PostgreSQL is ready"
    
    # Wait for Neo4j
    print_status "Waiting for Neo4j..."
    timeout=120
    while ! docker-compose exec -T neo4j cypher-shell -u neo4j -p password123 "RETURN 1" > /dev/null 2>&1; do
        sleep 5
        timeout=$((timeout - 5))
        if [ $timeout -le 0 ]; then
            print_error "Neo4j failed to start within 120 seconds"
            exit 1
        fi
    done
    print_success "Neo4j is ready"
    
    # Wait for Chroma
    print_status "Waiting for Chroma..."
    timeout=60
    while ! curl -f http://localhost:8001/api/v1/heartbeat > /dev/null 2>&1; do
        sleep 2
        timeout=$((timeout - 2))
        if [ $timeout -le 0 ]; then
            print_error "Chroma failed to start within 60 seconds"
            exit 1
        fi
    done
    print_success "Chroma is ready"
    
    # Wait for Redis
    print_status "Waiting for Redis..."
    timeout=30
    while ! docker-compose exec -T redis redis-cli -a redis123 ping > /dev/null 2>&1; do
        sleep 2
        timeout=$((timeout - 2))
        if [ $timeout -le 0 ]; then
            print_error "Redis failed to start within 30 seconds"
            exit 1
        fi
    done
    print_success "Redis is ready"
    
    # Wait for n8n
    print_status "Waiting for n8n..."
    timeout=60
    while ! curl -f http://localhost:5678/healthz > /dev/null 2>&1; do
        sleep 2
        timeout=$((timeout - 2))
        if [ $timeout -le 0 ]; then
            print_error "n8n failed to start within 60 seconds"
            exit 1
        fi
    done
    print_success "n8n is ready"
    
    # Wait for MinIO
    print_status "Waiting for MinIO..."
    timeout=60
    while ! curl -f http://localhost:9000/minio/health/live > /dev/null 2>&1; do
        sleep 2
        timeout=$((timeout - 2))
        if [ $timeout -le 0 ]; then
            print_error "MinIO failed to start within 60 seconds"
            exit 1
        fi
    done
    print_success "MinIO is ready"
}

# Initialize databases
initialize_databases() {
    print_status "Initializing databases..."
    
    # Initialize Neo4j
    if [ -f "init-scripts/01-neo4j-init.cypher" ]; then
        print_status "Initializing Neo4j knowledge graph..."
        docker-compose exec -T neo4j cypher-shell -u neo4j -p password123 -f /var/lib/neo4j/import/01-neo4j-init.cypher
        print_success "Neo4j initialized"
    else
        print_warning "Neo4j initialization script not found, skipping..."
    fi
    
    # PostgreSQL initialization is handled automatically by init scripts
    print_success "PostgreSQL initialized via init scripts"
}

# Create default collections and configurations
setup_defaults() {
    print_status "Setting up default configurations..."
    
    # Create default Chroma collection (will be done via API when backend is ready)
    print_status "Default Chroma collections will be created when backend starts"
    
    # Import n8n workflows if they exist
    if [ -d "n8n/workflows" ] && [ "$(ls -A n8n/workflows)" ]; then
        print_status "n8n workflows will be available in the workflows directory"
        print_status "Import them manually through the n8n UI at http://localhost:5678"
    fi
    
    print_success "Default configurations ready"
}

# Display service information
show_service_info() {
    print_success "Infrastructure setup completed successfully!"
    echo
    echo "Service URLs:"
    echo "  Neo4j Browser:    http://localhost:7474 (neo4j/password123)"
    echo "  Chroma API:       http://localhost:8001"
    echo "  Redis:            localhost:6379 (password: redis123)"
    echo "  PostgreSQL:       localhost:5432 (dc_agent/postgres123)"
    echo "  n8n:              http://localhost:5678 (admin/admin123)"
    echo "  MinIO Console:    http://localhost:9001 (minioadmin/minioadmin123)"
    echo
    echo "To stop services: docker-compose down"
    echo "To view logs: docker-compose logs -f [service_name]"
    echo "To restart: docker-compose restart [service_name]"
    echo
    print_warning "Remember to update passwords in production!"
}

# Main execution
main() {
    echo "DC Agent Infrastructure Setup"
    echo "============================="
    echo
    
    check_docker
    check_files
    create_directories
    start_services
    wait_for_services
    initialize_databases
    setup_defaults
    show_service_info
}

# Run main function
main "$@"