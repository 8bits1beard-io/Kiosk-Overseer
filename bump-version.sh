#!/usr/bin/env bash
set -euo pipefail

# Usage: ./bump-version.sh [major|minor|patch|X.Y.Z]
# Examples:
#   ./bump-version.sh patch       # 1.8.3 → 1.8.4
#   ./bump-version.sh minor       # 1.8.3 → 1.9.0
#   ./bump-version.sh major       # 1.8.3 → 2.0.0
#   ./bump-version.sh 2.0.0       # set explicitly

FILE="index.html"

# Extract current version from the BUILD line
CURRENT=$(grep -o 'BUILD [0-9]*\.[0-9]*\.[0-9]*' "$FILE" | head -1 | awk '{print $2}')
if [[ -z "$CURRENT" ]]; then
    echo "Error: could not find current version in $FILE" >&2
    exit 1
fi

IFS='.' read -r MAJOR MINOR PATCH <<< "$CURRENT"

case "${1:-}" in
    patch)  NEW="$MAJOR.$MINOR.$((PATCH + 1))" ;;
    minor)  NEW="$MAJOR.$((MINOR + 1)).0" ;;
    major)  NEW="$((MAJOR + 1)).0.0" ;;
    "")
        echo "Error: provide a version bump type or explicit version" >&2
        echo "Usage: $0 [major|minor|patch|X.Y.Z]" >&2
        exit 1
        ;;
    *)
        if [[ ! "$1" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
            echo "Error: '$1' is not a valid version (expected X.Y.Z)" >&2
            exit 1
        fi
        NEW="$1"
        ;;
esac

if [[ "$NEW" == "$CURRENT" ]]; then
    echo "Version is already $CURRENT — nothing to do."
    exit 0
fi

# Replace all occurrences in index.html
sed -i '' "s/\?v=$CURRENT/?v=$NEW/g; s/BUILD $CURRENT/BUILD $NEW/g" "$FILE"

# Count replacements
COUNT=$(grep -c "$NEW" "$FILE")
echo "$CURRENT → $NEW ($COUNT locations updated in $FILE)"
