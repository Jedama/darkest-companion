// src/utils/textUtils.tsx
import React from 'react';

/**
 * Parses a string and converts text between *asterisks* into bold React elements.
 * Example: "Hello *World*" -> ["Hello ", <strong>World</strong>]
 */
export const parseFormattedText = (text: string): React.ReactNode[] => {
  if (!text) return [];

  // Split by the asterisk pattern
  const parts = text.split(/(\*[^*]+\*)/g);

  return parts.map((part, index) => {
    if (part.startsWith('*') && part.endsWith('*')) {
      // Remove asterisks and return as Strong
      return <strong key={index}>{part.slice(1, -1)}</strong>;
    }
    // Return normal text string
    return part;
  });
};