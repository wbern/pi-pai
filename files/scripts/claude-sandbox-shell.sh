#!/bin/bash
# Debug shell into Claude container (no memory limit for debugging)
docker run -it --rm \
    -v ~/.claude-docker:/home/node/.claude \
    --entrypoint /bin/bash \
    claude-code
