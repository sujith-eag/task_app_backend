import connectDB from '../src/connect/database.js';
import File from '../src/models/fileModel.js';

const id = process.argv[2];
(async () => {
  try {
    await connectDB();
    const f = await File.findById(id).lean();
    if (!f) {
      console.log('NOT FOUND');
    } else {
      console.log(JSON.stringify(f, null, 2));
    }
    process.exit(0);
  } catch (e) {
    console.error('ERROR', e && e.message ? e.message : e);
    process.exit(1);
  }
})();
