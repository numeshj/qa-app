export function ok(data: any, meta?: any) { return { success: true, data, ...(meta ? { meta } : {}) }; }
export function fail(code: string, message: string, details?: any) { return { success: false, error: { code, message, ...(details ? { details } : {}) } }; }
