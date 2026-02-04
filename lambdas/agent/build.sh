#!/bin/bash
# Build script for Meal Agent Lambda
# Creates a deployment package with all Python dependencies

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "🔨 Building Meal Agent Lambda package..."

# Clean up
rm -rf package
mkdir -p package

# Install dependencies
echo "📦 Installing dependencies..."
pip install -r requirements.txt -t package --platform manylinux2014_x86_64 --only-binary=:all: --quiet

# Copy source files
echo "📄 Copying source files..."
cp meal_agent_handler.py package/
cp -r tools package/

# Create zip (optional - CDK can use the directory)
# cd package && zip -r ../deployment.zip . && cd ..

echo "✅ Build complete! Package ready at: $SCRIPT_DIR/package"
