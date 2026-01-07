#!/bin/bash
docker run -it --rm \
    -v ~/.claude-docker:/home/node/.claude \
    --entrypoint /bin/bash \
    claude-code
