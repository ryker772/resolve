// Adds sample complaints so the dashboard has something to show. Run: npm run seed:demo
// Works on the local database, or on Neon if DATABASE_URL is set in server/.env.
import bcrypt from 'bcryptjs';
import { db, dbReady, closeDb } from './db.js';
import { createComplaint, addMessage, logActivity } from './complaints.js';
import { sqlNow } from './util.js';

await dbReady();

const user = (email) => db.get('SELECT id, name FROM users WHERE email = ?', email);
const daysAgo = (d, h = 9) => {
  const t = new Date();
  t.setUTCDate(t.getUTCDate() - d);
  t.setUTCHours(h, 0, 0, 0);
  return t;
};

const samples = [
  { at: daysAgo(15), kind: 'Suggestion', category: 'General feedback', subject: 'Extend library opening hours during exams', details: 'The library closes at 10pm during exam weeks. Many students would benefit from 24-hour access in the two weeks before exams.', priority: 'Low', name: 'Sample Student A', matric: 'SAMPLE/001', status: 'Resolved', officer: 'admin@resolve.test', reply: 'Thanks for the suggestion. Management has approved extended hours for the next exam period.', rating: 5 },
  { at: daysAgo(12), kind: 'Complaint', category: 'Staff conduct', subject: 'Rude conduct at the bursary desk', details: 'When I went to the bursary to ask about my receipt, the staff at the desk shouted at me and refused to help.', priority: 'Low', anonymous: true, status: 'In progress', officer: 'admin@resolve.test', note: 'Spoke to the bursary supervisor. Following up with the staff member.' },
  { at: daysAgo(10), kind: 'Complaint', category: 'IT & student portal', subject: 'Portal logs me out during course registration', details: 'Every time I try to add my electives on the student portal it logs me out and I lose my selections.', priority: 'Normal', name: 'Sample Student B', matric: 'SAMPLE/002', status: 'In progress', officer: 'ict@resolve.test', reply: 'We have reproduced the issue and are working on a fix with the portal vendor.' },
  { at: daysAgo(9), kind: 'Complaint', category: 'Fees & finance', subject: 'Double charge on acceptance fee', details: 'I paid my acceptance fee once but my bank statement shows two debits on the same day for the same amount.', priority: 'Normal', name: 'Sample Student C', matric: 'SAMPLE/003', status: 'In progress', officer: 'bursary@resolve.test' },
  { at: daysAgo(6), kind: 'Complaint', category: 'Academics', subject: 'Course result not uploaded', details: 'My result for one of my courses from last semester is still showing as not available while my classmates can see theirs.', priority: 'Normal', name: 'Sample Student D', matric: 'SAMPLE/004', status: 'Awaiting student', officer: 'academics@resolve.test', reply: 'Please send the course code and the name of the lecturer so we can check with the department.' },
  { at: daysAgo(5, 8), kind: 'Complaint', category: 'Hostel & facilities', subject: 'Hostel water supply out since Monday', details: 'There has been no running water in Block C since Monday morning. Students are buying water to bathe and the toilets cannot flush.', location: 'Block C, all floors', priority: 'Urgent', name: 'Sample Student E', matric: 'SAMPLE/005', status: 'In progress', officer: 'hostel@resolve.test', reply: 'A plumber has been dispatched to check the pump serving Block C.', note: 'Pump for Block C likely tripped. Plumber scheduled for the morning.' },
  { at: daysAgo(0, 7), kind: 'Complaint', category: 'Hostel & facilities', subject: 'No power in Block A since last night', details: 'Block A has had no electricity since about 9pm yesterday. The other blocks have power.', location: 'Block A', priority: 'Urgent', anonymous: true, status: 'New' }
];

// Demo student account; some samples belong to it so "My complaints" has content.
let demo = await db.get("SELECT id FROM students WHERE email = 'student@resolve.test'");
if (!demo) {
  demo = {
    id: await db.insert('INSERT INTO students (name, matric, email, department, password_hash) VALUES (?, ?, ?, ?, ?)',
      'Demo Student', 'DEMO/0001', 'student@resolve.test', 'Computer Science', bcrypt.hashSync('Student@123', 10))
  };
}
const mine = new Set(['Hostel water supply out since Monday', 'Course result not uploaded', 'Extend library opening hours during exams']);

let made = 0;
for (const s of samples) {
  const { id, ticket, accessCode } = await createComplaint(
    { ...s, incidentDate: s.at.toISOString().slice(0, 10), email: '' }, [], s.at
  );
  if (mine.has(s.subject)) {
    await db.run('UPDATE complaints SET student_id = ?, name = ?, matric = ?, email = ? WHERE id = ?',
      demo.id, 'Demo Student', 'DEMO/0001', 'student@resolve.test', id);
  }
  const later = sqlNow(new Date(s.at.getTime() + 2 * 3600 * 1000));
  if (s.officer) {
    const o = await user(s.officer);
    await db.run('UPDATE complaints SET assigned_to = ? WHERE id = ?', o.id, id);
    await logActivity(id, 'System Admin', `Assigned to ${o.name}`);
    if (s.note) await addMessage(id, { authorType: 'staff', authorId: o.id, body: s.note, internal: true });
    if (s.reply) await addMessage(id, { authorType: 'staff', authorId: o.id, body: s.reply });
  }
  await db.run('UPDATE complaints SET status = ?, rating = ?, resolved_at = ?, updated_at = ? WHERE id = ?',
    s.status, s.rating || null, s.status === 'Resolved' ? later : null, later, id);
  console.log(`${ticket}  code ${accessCode}  ${s.status.padEnd(16)} ${s.subject}`);
  made++;
}
console.log(`\nAdded ${made} sample complaints. Use any ticket + code above on the Track page.`);
console.log('Demo student login: student@resolve.test / Student@123 (or matric DEMO/0001)');
await closeDb();
