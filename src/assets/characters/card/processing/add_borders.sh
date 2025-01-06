#!/bin/bash

# Directory paths
INPUT_DIR="card_art"
OUTPUT_DIR="bordered_cards"
BORDER="card_border.png"

# Fixed dimensions
TARGET_HEIGHT=720
TOP_OFFSET=77
FRAME_WIDTH=606
FRAME_HEIGHT=939

mkdir -p "$OUTPUT_DIR"

process_image() {
    local input_file="$1"
    local output_file="$OUTPUT_DIR/$(basename "$input_file")"
    
    echo "Processing: $input_file"
    
    # Step 1: Resize the card art to fit within the target height
    convert "$input_file" \
        -resize x$TARGET_HEIGHT \
        miff:- | \
    # Step 2: Add padding to position the art 70 pixels from the top
    convert - -gravity north -background none -extent ${FRAME_WIDTH}x${FRAME_HEIGHT}+0-$TOP_OFFSET \
        miff:- | \
    # Step 3: Composite the frame on top of the resized and positioned art
    convert - "$BORDER" -gravity center -composite "$output_file"
}

# Test mode
if [ "$1" = "--test" ]; then
    if [ -n "$2" ]; then
        process_image "$2"
        echo "Test complete. Check $OUTPUT_DIR"
        exit 0
    else
        echo "Usage for test: $0 --test <filename>"
        exit 1
    fi
fi

# Batch mode: Process all images in the input directory
for file in "$INPUT_DIR"/*; do
    process_image "$file"
done

echo "Batch processing complete. Check $OUTPUT_DIR"
