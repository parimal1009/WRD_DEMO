/**
 * Generate a standardized filename for saved documents.
 * Format: TenantName_DocDesc_YYYYMMDD_HHMMSS.docx
 */
export function generateFilename(tenantName, docDescription) {
  const now = new Date();
  const date = now.toISOString().slice(0, 10).replace(/-/g, '');   // YYYYMMDD
  const time = now.toTimeString().slice(0, 8).replace(/:/g, '');   // HHMMSS
  const safe = (s) => s.replace(/[^a-zA-Z0-9]/g, '_').replace(/_+/g, '_').slice(0, 40);
  
  const tenant = safe(tenantName || 'Unknown');
  const desc = safe(docDescription || 'Document');
  
  return `${tenant}_${desc}_${date}_${time}.docx`;
}

/**
 * Extract a reasonable document description from a filename.
 */
export function extractDocDescription(filename) {
  if (!filename) return 'Document';
  // Remove extension and path
  const name = filename.replace(/\\/g, '/').split('/').pop().replace(/\.docx$/i, '');
  // Replace underscores/dashes with spaces
  return name.replace(/[_-]/g, ' ').trim() || 'Document';
}
