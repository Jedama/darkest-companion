#!/bin/bash

# --- Configuration ---
INPUT_DIR="."       # Directory containing input PNG images (e.g., current directory)
OUTPUT_DIR="output" # Directory for modified images (will be created if it doesn't exist)

# --- Fixed Image Properties ---
ORIG_W=442
ORIG_H=565

# Core rectangle coordinates (inclusive: x1,y1 is top-left pixel; x2,y2 is bottom-right pixel)
CORE_X1=128
CORE_Y1=148
CORE_X2=316
CORE_Y2=422

# --- Derived Calculations (do not modify these) ---

# Core dimensions
CORE_W=$((CORE_X2 - CORE_X1 + 1))
CORE_H=$((CORE_Y2 - CORE_Y1 + 1))

# Original Margin Dimensions & Crop Starting Points
MARGIN_W_L=$CORE_X1
MARGIN_W_R=$((ORIG_W - (CORE_X2 + 1)))
MARGIN_H_T=$CORE_Y1
MARGIN_H_B=$((ORIG_H - (CORE_Y2 + 1)))

# Starting pixel coordinates for original right and bottom margins (for cropping)
ORIG_RIGHT_X_START=$((CORE_X2 + 1))
ORIG_BOTTOM_Y_START=$((CORE_Y2 + 1))

# New (halved) Margin Dimensions (using integer division, which rounds down)
NEW_MARGIN_W_L=$((MARGIN_W_L / 2))
NEW_MARGIN_W_R=$((MARGIN_W_R / 2))
NEW_MARGIN_H_T=$((MARGIN_H_T / 2))
NEW_MARGIN_H_B=$((MARGIN_H_B / 2))

# New Total Image Dimensions
NEW_W=$((NEW_MARGIN_W_L + CORE_W + NEW_MARGIN_W_R)) # Fix: changed NEW_MARGIN_R to NEW_MARGIN_W_R
NEW_H=$((NEW_MARGIN_H_T + CORE_H + NEW_MARGIN_H_B))

# --- Output Information ---
echo "--- Image Modification Configuration ---"
echo "  Original Image Size: ${ORIG_W}x${ORIG_H}"
echo "  Core Rectangle (x1,y1 to x2,y2): (${CORE_X1},${CORE_Y1}) to (${CORE_X2},${CORE_Y2})"
echo "  Core Dimensions: ${CORE_W}x${CORE_H}"
echo "  Original Margin Sizes (Left, Right, Top, Bottom): ${MARGIN_W_L}, ${MARGIN_W_R}, ${MARGIN_H_T}, ${MARGIN_H_B}"
echo "  New Margin Sizes (Left, Right, Top, Bottom): ${NEW_MARGIN_W_L}, ${NEW_MARGIN_W_R}, ${NEW_MARGIN_H_T}, ${NEW_MARGIN_H_B}"
echo "  New Output Image Size: ${NEW_W}x${NEW_H}"
echo "----------------------------------------"
mkdir -p "$OUTPUT_DIR" # Create output directory if it doesn't exist
echo "Output directory: $OUTPUT_DIR"

# --- Processing Loop ---
for input_file in "$INPUT_DIR"/*.png; do
    if [ -f "$input_file" ]; then
        filename=$(basename -- "$input_file")
        output_file="$OUTPUT_DIR/${filename%.png}_modified.png"

        echo "Processing '$filename' -> '$output_file'..."
        echo "  New Canvas Size: ${NEW_W}x${NEW_H}"

        # Debugging Echos for each piece:
        echo "  1. TL: Crop ${MARGIN_W_L}x${MARGIN_H_T}+0+0 -> Resize ${NEW_MARGIN_W_L}x${NEW_MARGIN_H_T}! -> Paste +0+0"
        echo "  2. TM: Crop ${CORE_W}x${MARGIN_H_T}+${CORE_X1}+0 -> Resize ${CORE_W}x${NEW_MARGIN_H_T}! -> Paste +${NEW_MARGIN_W_L}+0"
        echo "  3. TR: Crop ${MARGIN_W_R}x${MARGIN_H_T}+${ORIG_RIGHT_X_START}+0 -> Resize ${NEW_MARGIN_W_R}x${NEW_MARGIN_H_T}! -> Paste +$((NEW_MARGIN_W_L + CORE_W))+0"
        echo "  4. ML: Crop ${MARGIN_W_L}x${CORE_H}+0+${CORE_Y1} -> Resize ${NEW_MARGIN_W_L}x${CORE_H}! -> Paste +0+${NEW_MARGIN_H_T}"
        echo "  5. MC (Core): Crop ${CORE_W}x${CORE_H}+${CORE_X1}+${CORE_Y1} (no resize) -> Paste +${NEW_MARGIN_W_L}+${NEW_MARGIN_H_T}"
        echo "  6. MR: Crop ${MARGIN_W_R}x${CORE_H}+${ORIG_RIGHT_X_START}+${CORE_Y1} -> Resize ${NEW_MARGIN_W_R}x${CORE_H}! -> Paste +$((NEW_MARGIN_W_L + CORE_W))+${NEW_MARGIN_H_T}"
        echo "  7. BL: Crop ${MARGIN_W_L}x${MARGIN_H_B}+0+${ORIG_BOTTOM_Y_START} -> Resize ${NEW_MARGIN_W_L}x${NEW_MARGIN_H_B}! -> Paste +0+$((NEW_MARGIN_H_T + CORE_H))"
        echo "  8. BM: Crop ${CORE_W}x${MARGIN_H_B}+${CORE_X1}+${ORIG_BOTTOM_Y_START} -> Resize ${CORE_W}x${NEW_MARGIN_H_B}! -> Paste +${NEW_MARGIN_W_L}+$((NEW_MARGIN_H_T + CORE_H))"
        echo "  9. BR: Crop ${MARGIN_W_R}x${MARGIN_H_B}+${ORIG_RIGHT_X_START}+${ORIG_BOTTOM_Y_START} -> Resize ${NEW_MARGIN_W_R}x${NEW_MARGIN_H_B}! -> Paste +$((NEW_MARGIN_W_L + CORE_W))+$((NEW_MARGIN_H_T + CORE_H))"


        convert -size "${NEW_W}x${NEW_H}" xc:none \
          `# 1. Top-Left Corner (TL)` \
          \( "$input_file" -crop "${MARGIN_W_L}x${MARGIN_H_T}+0+0" -resize "${NEW_MARGIN_W_L}x${NEW_MARGIN_H_T}!" +repage \) -geometry +0+0 -composite \
          `# 2. Top-Middle (TM)` \
          \( "$input_file" -crop "${CORE_W}x${MARGIN_H_T}+${CORE_X1}+0" -resize "${CORE_W}x${NEW_MARGIN_H_T}!" +repage \) -geometry +${NEW_MARGIN_W_L}+0 -composite \
          `# 3. Top-Right Corner (TR)` \
          \( "$input_file" -crop "${MARGIN_W_R}x${MARGIN_H_T}+${ORIG_RIGHT_X_START}+0" -resize "${NEW_MARGIN_W_R}x${NEW_MARGIN_H_T}!" +repage \) -geometry +$((NEW_MARGIN_W_L + CORE_W))+0 -composite \
          \
          `# 4. Middle-Left (ML)` \
          \( "$input_file" -crop "${MARGIN_W_L}x${CORE_H}+0+${CORE_Y1}" -resize "${NEW_MARGIN_W_L}x${CORE_H}!" +repage \) -geometry +0+${NEW_MARGIN_H_T} -composite \
          `# 5. Middle-Center (MC - CORE)` \
          \( "$input_file" -crop "${CORE_W}x${CORE_H}+${CORE_X1}+${CORE_Y1}" +repage \) -geometry +${NEW_MARGIN_W_L}+${NEW_MARGIN_H_T} -composite \
          `# 6. Middle-Right (MR)` \
          \( "$input_file" -crop "${MARGIN_W_R}x${CORE_H}+${ORIG_RIGHT_X_START}+${CORE_Y1}" -resize "${NEW_MARGIN_W_R}x${CORE_H}!" +repage \) -geometry +$((NEW_MARGIN_W_L + CORE_W))+${NEW_MARGIN_H_T} -composite \
          \
          `# 7. Bottom-Left Corner (BL)` \
          \( "$input_file" -crop "${MARGIN_W_L}x${MARGIN_H_B}+0+${ORIG_BOTTOM_Y_START}" -resize "${NEW_MARGIN_W_L}x${NEW_MARGIN_H_B}!" +repage \) -geometry +0+$((NEW_MARGIN_H_T + CORE_H)) -composite \
          `# 8. Bottom-Middle (BM)` \
          \( "$input_file" -crop "${CORE_W}x${MARGIN_H_B}+${CORE_X1}+${ORIG_BOTTOM_Y_START}" -resize "${CORE_W}x${NEW_MARGIN_H_B}!" +repage \) -geometry +${NEW_MARGIN_W_L}+$((NEW_MARGIN_H_T + CORE_H)) -composite \
          `# 9. Bottom-Right Corner (BR)` \
          \( "$input_file" -crop "${MARGIN_W_R}x${MARGIN_H_B}+${ORIG_RIGHT_X_START}+${ORIG_BOTTOM_Y_START}" -resize "${NEW_MARGIN_W_R}x${NEW_MARGIN_H_B}!" +repage \) -geometry +$((NEW_MARGIN_W_L + CORE_W))+$((NEW_MARGIN_H_T + CORE_H)) -composite \
          "$output_file"
    fi
done

echo "All images processed. Output can be found in the '$OUTPUT_DIR/' directory."