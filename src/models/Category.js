import mongoose from 'mongoose';

const categorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    level: {
      type: String,
      enum: ['legacy', 'parent', 'sub'],
      default: 'legacy',
    },
    parentCategory: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      default: null,
    },
    scopeKey: { type: String, unique: true, sparse: true },
    description: { type: String, default: '' },
    image: { type: String, default: '' },
    imagePublicId: { type: String, default: '' },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

const Category = mongoose.model('Category', categorySchema);
export default Category;
