// Chilean peso formatter — was copy-pasted as a local `fmt` in 6+ admin/public views.
export const formatCLP = n => Number(n || 0).toLocaleString('es-CL');
