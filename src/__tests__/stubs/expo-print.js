// Stand-in for expo-print. Records the HTML it was given so a test can assert
// on what would have been printed.
export const printed = [];
export async function printToFileAsync({ html }) {
  printed.push(html);
  return { uri: "file:///cache/print/album.pdf" };
}
