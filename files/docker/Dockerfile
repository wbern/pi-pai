FROM node:22-slim

RUN apt-get update && apt-get install -y \
    git \
    curl \
    sudo \
    && rm -rf /var/lib/apt/lists/*

# Enable corepack for pnpm (available for projects)
RUN corepack enable && corepack prepare pnpm@latest --activate

# Install global packages with npm (happy-coder has issues with pnpm's isolated home)
# happy-coder (happy.engineering) wraps Claude Code for phone access via text/voice
RUN npm install -g @anthropic-ai/claude-code happy-coder

# node user already has UID 1000, matching typical host user for bind mounts
RUN echo "node ALL=(ALL) NOPASSWD:ALL" >> /etc/sudoers

USER node

# Create tmp directory on same filesystem as .claude to avoid EXDEV errors
RUN mkdir -p /home/node/.claude/tmp

# Git config for commits (customize these)
RUN git config --global user.name "Claude (Pi)" && \
    git config --global user.email "claude@localhost"

WORKDIR /workspace

# Using happy-coder wrapper; replace with "claude" if not using happy
ENTRYPOINT ["happy", "--dangerously-skip-permissions"]
