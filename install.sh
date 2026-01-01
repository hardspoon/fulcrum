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

    # Try Homebrew first (works on both macOS and Linux)
    if command -v brew &> /dev/null; then
        if brew install dtach; then
            print_success "dtach installed via Homebrew"
            return 0
        fi
    fi

    # Fallback to system package managers
    if command -v apt &> /dev/null; then
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

# Ask user a yes/no question
ask_yes_no() {
    local prompt="$1"
    local default="${2:-n}"
    local response

    if [ "$default" = "y" ]; then
        prompt="$prompt [Y/n] "
    else
        prompt="$prompt [y/N] "
    fi

    read -r -p "$prompt" response
    response=${response:-$default}

    case "$response" in
        [yY][eE][sS]|[yY]) return 0 ;;
        *) return 1 ;;
    esac
}

# Check and offer to install Docker (optional, for app deployment)
install_docker() {
    print_step "Checking for Docker..."

    if command -v docker &> /dev/null; then
        print_success "Docker is already installed"
        return 0
    fi

    echo ""
    echo -e "${YELLOW}Docker enables app deployment features in Vibora.${NC}"
    echo "  - Deploy apps with Docker Compose"
    echo "  - Automatic domain routing with Traefik"
    echo "  - Container monitoring and logs"
    echo ""

    if ! ask_yes_no "Would you like to install Docker?"; then
        print_warning "Skipping Docker installation"
        echo "  You can install it later: https://docs.docker.com/get-docker/"
        return 0
    fi

    print_warning "Installing Docker..."

    # Try Homebrew first (works on both macOS and Linux)
    if command -v brew &> /dev/null; then
        if [[ "$(uname)" == "Darwin" ]]; then
            # macOS: use cask for Docker Desktop
            if brew install --cask docker; then
                print_success "Docker installed via Homebrew"
                echo "  Please open Docker Desktop to complete setup"
                return 0
            fi
        else
            # Linux: use formula for docker engine
            if brew install docker docker-compose; then
                print_success "Docker installed via Homebrew"
                return 0
            fi
        fi
    fi

    # Fallback to system package managers / official script
    if command -v apt &> /dev/null; then
        # Docker's official install script
        if curl -fsSL https://get.docker.com | sh; then
            print_success "Docker installed"
            # Add user to docker group
            if [ -n "$SUDO_USER" ]; then
                sudo usermod -aG docker "$SUDO_USER"
                echo "  Log out and back in for group changes to take effect"
            fi
            return 0
        fi
    elif command -v dnf &> /dev/null; then
        if sudo dnf install -y docker docker-compose-plugin && sudo systemctl enable --now docker; then
            print_success "Docker installed via dnf"
            if [ -n "$SUDO_USER" ]; then
                sudo usermod -aG docker "$SUDO_USER"
            fi
            return 0
        fi
    elif command -v pacman &> /dev/null; then
        if sudo pacman -S --noconfirm docker docker-compose && sudo systemctl enable --now docker; then
            print_success "Docker installed via pacman"
            if [ -n "$SUDO_USER" ]; then
                sudo usermod -aG docker "$SUDO_USER"
            fi
            return 0
        fi
    fi

    print_warning "Could not install Docker automatically"
    echo "  Install manually: https://docs.docker.com/get-docker/"
    return 1
}

# Check and offer to install cloudflared (optional, for tunnel access)
install_cloudflared() {
    print_step "Checking for cloudflared..."

    if command -v cloudflared &> /dev/null; then
        print_success "cloudflared is already installed"
        return 0
    fi

    echo ""
    echo -e "${YELLOW}Cloudflared enables secure tunnel access to deployed apps.${NC}"
    echo "  - Expose apps to the internet without port forwarding"
    echo "  - Automatic HTTPS with Cloudflare certificates"
    echo "  - Optional DNS integration for custom domains"
    echo ""

    if ! ask_yes_no "Would you like to install cloudflared?"; then
        print_warning "Skipping cloudflared installation"
        echo "  You can install it later: https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation/"
        return 0
    fi

    print_warning "Installing cloudflared..."

    # Try Homebrew first (works on both macOS and Linux)
    if command -v brew &> /dev/null; then
        if brew install cloudflared; then
            print_success "cloudflared installed via Homebrew"
            return 0
        fi
    fi

    # Fallback to system package managers
    if command -v apt &> /dev/null; then
        # Add Cloudflare's GPG key and repo
        if curl -fsSL https://pkg.cloudflare.com/cloudflare-main.gpg | sudo tee /usr/share/keyrings/cloudflare-main.gpg > /dev/null && \
           echo "deb [signed-by=/usr/share/keyrings/cloudflare-main.gpg] https://pkg.cloudflare.com/cloudflared $(lsb_release -cs) main" | sudo tee /etc/apt/sources.list.d/cloudflared.list && \
           sudo apt update && sudo apt install -y cloudflared; then
            print_success "cloudflared installed via apt"
            return 0
        fi
    elif command -v dnf &> /dev/null; then
        if sudo dnf install -y cloudflared; then
            print_success "cloudflared installed via dnf"
            return 0
        fi
    elif command -v pacman &> /dev/null; then
        if sudo pacman -S --noconfirm cloudflared; then
            print_success "cloudflared installed via pacman"
            return 0
        fi
    fi

    # Fallback: try downloading binary directly
    local arch
    arch=$(uname -m)
    case "$arch" in
        x86_64) arch="amd64" ;;
        aarch64|arm64) arch="arm64" ;;
        *) print_warning "Unsupported architecture: $arch"; return 1 ;;
    esac

    local os
    os=$(uname -s | tr '[:upper:]' '[:lower:]')

    if curl -fsSL "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-${os}-${arch}" -o /tmp/cloudflared && \
       chmod +x /tmp/cloudflared && \
       sudo mv /tmp/cloudflared /usr/local/bin/cloudflared; then
        print_success "cloudflared installed"
        return 0
    fi

    print_warning "Could not install cloudflared automatically"
    echo "  Install manually: https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation/"
    return 1
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
    echo -e "${BLUE}╔═════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║${NC}           Vibora Installation Script            ${BLUE}║${NC}"
    echo -e "${BLUE}║${NC}  Harness Attention. Orchestrate Agents. Ship.  ${BLUE}║${NC}"
    echo -e "${BLUE}╚═════════════════════════════════════════════════╝${NC}"
    echo ""

    check_dependencies
    install_dtach
    install_vibora
    install_claude_code
    install_uv
    install_vibora_plugin

    # Optional: App deployment dependencies
    echo ""
    echo -e "${BLUE}━━━ Optional: App Deployment ━━━${NC}"
    install_docker
    install_cloudflared

    start_vibora
}

main "$@"
