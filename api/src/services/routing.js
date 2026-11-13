export async function route(c, zip) {
  return (
    (
      await c.query(
        "SELECT p.* FROM territories t JOIN partners p ON p.id=t.partner_id WHERE t.zip=$1 AND p.status='active'",
        [zip],
      )
    ).rows[0] || null
  );
}
