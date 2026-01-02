#!/usr/bin/env python3
"""
Script to read JSON files and print location summaries.
"""

import json
import os
import sys
from pathlib import Path


def print_summaries(folder_path):
    """
    Read all JSON files in the specified folder and print summaries.
    
    Args:
        folder_path: Path to the folder containing JSON files
    """
    folder = Path(folder_path)
    
    if not folder.exists():
        print(f"Error: Folder '{folder_path}' does not exist.")
        return
    
    if not folder.is_dir():
        print(f"Error: '{folder_path}' is not a directory.")
        return
    
    # Find all JSON files
    json_files = sorted(folder.glob("*.json"))
    
    if not json_files:
        print(f"No JSON files found in '{folder_path}'")
        return
    
    print(f"Found {len(json_files)} JSON file(s)\n")
    print("=" * 80)
    
    # Process each JSON file
    for json_file in json_files:
        print(f"\nFile: {json_file.name}")
        print("-" * 80)
        
        try:
            with open(json_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            # Handle if data is a list of locations
            if isinstance(data, list):
                locations = data
            # Handle if data is a dict with locations in a key
            elif isinstance(data, dict):
                # Try common keys
                locations = data.get('locations', data.get('items', [data]))
            else:
                locations = [data]
            
            # Print summaries
            for i, location in enumerate(locations, 1):
                if isinstance(location, dict) and 'summary' in location:
                    print(f"{i}. {location['summary']}")
                else:
                    print(f"{i}. [No summary found]")
            
            print(f"\nTotal locations in this file: {len(locations)}")
            
        except json.JSONDecodeError as e:
            print(f"Error parsing JSON: {e}")
        except Exception as e:
            print(f"Error reading file: {e}")
        
        print("-" * 80)
    
    print("\n" + "=" * 80)


def main():
    """Main entry point."""
    if len(sys.argv) > 1:
        folder_path = sys.argv[1]
    else:
        # Default to current directory
        folder_path = "."
    
    print(f"Scanning folder: {os.path.abspath(folder_path)}\n")
    print_summaries(folder_path)


if __name__ == "__main__":
    main()