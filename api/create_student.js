export default async function handler(req, res) {
  return res.status(200).json({
    success: true,
    message: 'CREATE_STUDENT_ROUTE_LIVE'
  });
}