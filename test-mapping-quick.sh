#!/bin/bash

# Quick test script to verify all migration APIs support mapping strategies
BASE_URL="http://localhost:3000/api/v1/migration"

echo "🚀 Testing Migration API Mapping Strategies"
echo "============================================="

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test function
test_service() {
    local service=$1
    local mapping=$2
    local payload=$3
    
    echo -e "${YELLOW}Testing ${service} with ${mapping} mapping...${NC}"
    
    response=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/${service}" \
        -H "Content-Type: application/json" \
        -H "x-test-mode: true" \
        -d "$payload")
    
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n -1)
    
    if [ "$http_code" = "200" ]; then
        echo -e "${GREEN}✅ ${service} ${mapping}: SUCCESS${NC}"
        return 0
    else
        echo -e "${RED}❌ ${service} ${mapping}: FAILED (HTTP $http_code)${NC}"
        echo "   Response: $body"
        return 1
    fi
}

# Test configurations
ONE_TO_ONE_PAYLOAD='{
  "sourceAdminEmail": "admin@source.com",
  "targetAdminEmail": "admin@target.com",
  "scenario": "cross-tenant",
  "domainMapping": "one-to-one",
  "userMappings": [
    {"sourceUserEmail": "user1@source.com", "targetUserEmail": "user1@target.com"},
    {"sourceUserEmail": "user2@source.com", "targetUserEmail": "user2@target.com"}
  ],
  "migrationOptions": {"batchSize": 10},
  "dryRun": true,
  "realDataMode": false
}'

ONE_TO_MANY_PAYLOAD='{
  "sourceAdminEmail": "admin@source.com",
  "targetAdminEmail": "admin@target1.com",
  "scenario": "cross-tenant", 
  "domainMapping": "one-to-many",
  "userMappings": [
    {"sourceUserEmail": "user1@source.com", "targetUserEmail": "user1@target1.com"},
    {"sourceUserEmail": "user2@source.com", "targetUserEmail": "user2@target2.com"}
  ],
  "migrationOptions": {"batchSize": 10},
  "dryRun": true,
  "realDataMode": false
}'

MANY_TO_ONE_PAYLOAD='{
  "sourceAdminEmail": "admin@source1.com",
  "targetAdminEmail": "admin@target.com",
  "scenario": "cross-tenant",
  "domainMapping": "many-to-one", 
  "userMappings": [
    {"sourceUserEmail": "user1@source1.com", "targetUserEmail": "user1@target.com"},
    {"sourceUserEmail": "user2@source2.com", "targetUserEmail": "user2@target.com"}
  ],
  "migrationOptions": {"batchSize": 10},
  "dryRun": true,
  "realDataMode": false
}'

# Services to test
SERVICES=("gmail" "drive" "calendar" "contacts" "chat" "groups" "photos" "forms" "slides")

# Run tests
total_tests=0
passed_tests=0

for service in "${SERVICES[@]}"; do
    echo -e "\n📋 Testing $service service:"
    echo "--------------------------------"
    
    # Test one-to-one
    total_tests=$((total_tests + 1))
    if test_service "$service" "one-to-one" "$ONE_TO_ONE_PAYLOAD"; then
        passed_tests=$((passed_tests + 1))
    fi
    
    # Test one-to-many
    total_tests=$((total_tests + 1))
    if test_service "$service" "one-to-many" "$ONE_TO_MANY_PAYLOAD"; then
        passed_tests=$((passed_tests + 1))
    fi
    
    # Test many-to-one
    total_tests=$((total_tests + 1))
    if test_service "$service" "many-to-one" "$MANY_TO_ONE_PAYLOAD"; then
        passed_tests=$((passed_tests + 1))
    fi
    
    sleep 0.1  # Brief pause between tests
done

# Print summary
echo -e "\n\n📊 TEST SUMMARY"
echo "==============="
echo -e "Total Tests: $total_tests"
echo -e "Passed: ${GREEN}$passed_tests${NC}"
echo -e "Failed: ${RED}$((total_tests - passed_tests))${NC}"
echo -e "Success Rate: $(( (passed_tests * 100) / total_tests ))%"

if [ $passed_tests -eq $total_tests ]; then
    echo -e "\n🎉 ${GREEN}ALL TESTS PASSED!${NC}"
    exit 0
else
    echo -e "\n⚠️  ${RED}SOME TESTS FAILED${NC}"
    exit 1
fi
