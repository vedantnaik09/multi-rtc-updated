export function extractJson(input: string): any {
  try {
    // First, try to parse the entire input as JSON
    return JSON.parse(input);
  } catch (e) {
    // If that fails, try to find JSON within the string
    const jsonMatch = input.match(/\{(?:[^{}]|\{(?:[^{}]|\{[^{}]*\})*\})*\}/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0]);
      } catch (e) {
        console.error("Found JSON-like string, but failed to parse:", jsonMatch[0]);
        return null;
      }
    }
    console.error("No valid JSON found in the input");
    return null;
  }
}