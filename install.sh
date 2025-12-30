#!/bin/bash
# Vibora Installation Script
# Usage: curl -fsSL https://raw.githubusercontent.com/knowsuchagency/vibora/main/install.sh | bash

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_step() {
    echo -e "${BLUE}==>${NC} $1"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}!${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

# Check for required dependencies
check_dependencies() {
    print_step "Checking dependencies..."

    # Check for Node.js
    if ! command -v node &> /dev/null; then
        print_error "Node.js is required but not installed."
        echo "  Install from: https://nodejs.org/"
        exit 1
    fi

    NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -lt 18 ]; then
        print_error "Node.js 18+ is required. Found: $(node -v)"
        exit 1
    fi
    print_success "Node.js $(node -v)"

    # Check for npm
    if ! command -v npm &> /dev/null; then
        print_error "npm is required but not installed."
        exit 1
    fi
    print_success "npm $(npm -v)"
}

# Check and install dtach
install_dtach() {
    print_step "Checking for dtach..."

    if command -v dtach &> /dev/null; then
        print_success "dtach is already installed"
        return 0
    fi

    print_warning "dtach not found. Installing..."

    if command -v brew &> /dev/null; then
        if brew install dtach; then
            print_success "dtach installed via Homebrew"
            return 0
        fi
    elif command -v apt &> /dev/null; then
        if sudo apt install -y dtach; then
            print_success "dtach installed via apt"
            return 0
        fi
    elif command -v dnf &> /dev/null; then
        if sudo dnf install -y dtach; then
            print_success "dtach installed via dnf"
            return 0
        fi
    elif command -v pacman &> /dev/null; then
        if sudo pacman -S --noconfirm dtach; then
            print_success "dtach installed via pacman"
            return 0
        fi
    fi

    print_warning "Could not install dtach automatically"
    echo "  Install manually using your package manager"
    return 1
}

# Check and install uv
install_uv() {
    print_step "Checking for uv..."

    if command -v uv &> /dev/null; then
        print_success "uv is already installed"
        return 0
    fi

    print_warning "uv not found. Installing..."

    if command -v brew &> /dev/null; then
        if brew install uv; then
            print_success "uv installed via Homebrew"
            return 0
        fi
    fi

    # Fall back to curl installer
    if curl -LsSf https://astral.sh/uv/install.sh | sh; then
        print_success "uv installed via curl"
        return 0
    fi

    print_warning "Could not install uv automatically"
    echo "  Install manually: curl -LsSf https://astral.sh/uv/install.sh | sh"
    return 1
}

# Install vibora CLI globally
install_vibora() {
    print_step "Installing vibora..."

    if npm install -g vibora@latest; then
        print_success "vibora installed"
    else
        print_error "Failed to install vibora"
        exit 1
    fi
}

# Check and install Claude Code
install_claude_code() {
    print_step "Checking for Claude Code..."

    if command -v claude &> /dev/null; then
        print_success "Claude Code is already installed"
        return 0
    fi

    print_warning "Claude Code not found. Installing..."

    # Claude Code is installed via npm
    if npm install -g @anthropic-ai/claude-code; then
        print_success "Claude Code installed"
    else
        print_warning "Could not install Claude Code automatically"
        echo "  Install manually: npm install -g @anthropic-ai/claude-code"
        echo "  Or visit: https://claude.ai/code"
        return 1
    fi
}

# Install vibora plugin for Claude Code
install_vibora_plugin() {
    print_step "Installing vibora plugin for Claude Code..."

    if ! command -v claude &> /dev/null; then
        print_warning "Skipping plugin installation (Claude Code not available)"
        return 0
    fi

    # Add the vibora marketplace
    if claude plugin marketplace add knowsuchagency/vibora 2>/dev/null; then
        print_success "Added vibora marketplace"
    else
        print_warning "Could not add vibora marketplace (may already exist)"
    fi

    # Install the plugin globally
    if claude plugin install vibora@vibora --scope user 2>/dev/null; then
        print_success "Installed vibora plugin"
    else
        print_warning "Could not install vibora plugin"
        echo "  Try manually: claude plugin install vibora@vibora --scope user"
    fi
}

# Start vibora server
start_vibora() {
    print_step "Starting vibora server..."

    if vibora up; then
        print_success "vibora server started"
        echo ""
        echo -e "${GREEN}Installation complete!${NC}"
        echo ""
        echo "Open http://localhost:7777 in your browser"
        echo ""
        echo "Commands:"
        echo "  vibora status    # Check server status"
        echo "  vibora doctor    # Check all dependencies"
        echo "  vibora down      # Stop server"
        echo "  vibora up        # Start server"
    else
        print_error "Failed to start vibora server"
        echo "  Try: vibora up --help"
        exit 1
    fi
}

# Main installation flow
main() {
    echo ""
    echo -e "${BLUE}╔═══════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║${NC}     Vibora Installation Script        ${BLUE}║${NC}"
    echo -e "${BLUE}║${NC}     The Vibe Engineer's Cockpit       ${BLUE}║${NC}"
    echo -e "${BLUE}╚═══════════════════════════════════════╝${NC}"
    echo ""

    check_dependencies
    install_dtach
    install_vibora
    install_claude_code
    install_uv
    install_vibora_plugin
    start_vibora
}

main "$@"
