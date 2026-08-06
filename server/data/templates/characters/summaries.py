#!/usr/bin/env python3
"""
Script to read character JSON files and print character summaries.
"""

import json
import os
import sys
from pathlib import Path


def extract_characters(data):
    """
    Extract a list of character dicts from JSON data.
    Handles single character dicts, lists of characters, or dict maps.
    """
    if isinstance(data, list):
        return data

    if isinstance(data, dict):
        # Case 1: Dict with a wrapper key like "characters" or "items"
        if "characters" in data and isinstance(data["characters"], list):
            return data["characters"]
        if "items" in data and isinstance(data["items"], list):
            return data["items"]

        # Case 2: Single character object
        if "summary" in data or "identifier" in data or "name" in data:
            return [data]

        # Case 3: Dict map of key -> character object (e.g. { "aesthete": { ... } })
        nested = []
        for val in data.values():
            if isinstance(val, dict) and ("summary" in val or "title" in val or "name" in val):
                nested.append(val)
        if nested:
            return nested

    return []


def print_character_summaries(folder_path):
    """
    Read all JSON files in the specified folder and print character summaries.
    
    Args:
        folder_path: Path to the folder containing character JSON files
    """
    folder = Path(folder_path)

    if not folder.exists():
        print(f"Error: Folder '{folder_path}' does not exist.")
        return

    if not folder.is_dir():
        print(f"Error: '{folder_path}' is not a directory.")
        return

    json_files = sorted(folder.glob("*.json"))

    if not json_files:
        print(f"No JSON files found in '{folder_path}'")
        return

    print(f"Scanning folder: {os.path.abspath(folder_path)}\n")
    print(f"Found {len(json_files)} JSON file(s)\n")
    print("=" * 80)

    total_characters = 0

    for json_file in json_files:
        print(f"\nFile: {json_file.name}")
        print("-" * 80)

        try:
            with open(json_file, "r", encoding="utf-8") as f:
                data = json.load(f)

            characters = extract_characters(data)

            if not characters:
                print("[No valid character objects found in this file]")
            else:
                for i, char in enumerate(characters, 1):
                    if isinstance(char, dict):
                        identifier = char.get("identifier", "unknown")
                        name = char.get("name", "Unnamed")
                        title = char.get("title", "No Title")
                        summary = char.get("summary", "[No summary found]")
                        traits = char.get("traits", [])

                        traits_str = f"\n   Traits: {', '.join(traits)}" if traits else ""
                        print(f"{i}. {identifier} ({name}, the {title})")
                        print(f"   Summary: {summary}{traits_str}\n")
                    else:
                        print(f"{i}. [Invalid character object]")

            count = len(characters)
            total_characters += count
            print(f"Total characters in this file: {count}")

        except json.JSONDecodeError as e:
            print(f"Error parsing JSON: {e}")
        except Exception as e:
            print(f"Error reading file: {e}")

        print("-" * 80)

    print("\n" + "=" * 80)
    print(f"Total characters found across all files: {total_characters}")
    print("=" * 80)


def main():
    """Main entry point."""
    if len(sys.argv) > 1:
        folder_path = sys.argv[1]
    else:
        # Default to current directory
        folder_path = "."

    print_character_summaries(folder_path)


if __name__ == "__main__":
    main()