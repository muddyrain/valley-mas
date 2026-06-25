#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
APP_DIR="$ROOT_DIR/apps/world-sim"

NODE_VERSION="${NODE_VERSION:-22.16.0}"
NODE_CACHE_DIR="${NODE_CACHE_DIR:-$ROOT_DIR/.cache/node}"
DEFAULT_TEST_COMMAND=(pnpm --filter @valley/world-sim test:balance)

detect_platform() {
  local os
  local arch
  os="$(uname -s)"
  arch="$(uname -m)"

  case "$os" in
    Darwin) os="darwin" ;;
    Linux) os="linux" ;;
    *)
      echo "Unsupported OS: $os" >&2
      exit 1
      ;;
  esac

  case "$arch" in
    arm64 | aarch64) arch="arm64" ;;
    x86_64 | amd64) arch="x64" ;;
    *)
      echo "Unsupported CPU architecture: $arch" >&2
      exit 1
      ;;
  esac

  echo "$os-$arch"
}

ensure_node() {
  if command -v node >/dev/null 2>&1; then
    echo "Using existing node: $(command -v node)"
    node --version
    return
  fi

  local platform
  local package_name
  local install_dir
  local archive_path
  local url

  platform="$(detect_platform)"
  package_name="node-v${NODE_VERSION}-${platform}"
  install_dir="$NODE_CACHE_DIR/$package_name"
  archive_path="$NODE_CACHE_DIR/$package_name.tar.xz"
  url="https://nodejs.org/dist/v${NODE_VERSION}/$package_name.tar.xz"

  if [[ ! -x "$install_dir/bin/node" ]]; then
    mkdir -p "$NODE_CACHE_DIR"
    echo "Downloading Node.js v$NODE_VERSION for $platform"
    echo "$url"
    curl -fL "$url" -o "$archive_path"
    rm -rf "$install_dir"
    tar -xJf "$archive_path" -C "$NODE_CACHE_DIR"
  else
    echo "Using cached Node.js: $install_dir"
  fi

  export PATH="$install_dir/bin:$PATH"
  node --version
}

ensure_pnpm() {
  if command -v pnpm >/dev/null 2>&1; then
    echo "Using pnpm: $(command -v pnpm)"
    pnpm --version
    return
  fi

  if ! command -v corepack >/dev/null 2>&1; then
    echo "pnpm and corepack were not found after Node setup." >&2
    exit 1
  fi

  echo "Enabling pnpm through corepack"
  corepack enable
  corepack prepare pnpm@9.15.0 --activate
  pnpm --version
}

run_tests() {
  cd "$ROOT_DIR"

  if [[ $# -gt 0 ]]; then
    echo "Running custom command: $*"
    "$@"
    return
  fi

  echo "Running default command: ${DEFAULT_TEST_COMMAND[*]}"
  "${DEFAULT_TEST_COMMAND[@]}"
}

ensure_node
ensure_pnpm

echo "WorldSim app dir: $APP_DIR"
run_tests "$@"
