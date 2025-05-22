import express from 'express';
import mongoose from 'mongoose';
import Tasks from '../database/models/tasks.mjs';
import TaskRules from '../database/models/task-rules.mjs';

const router = express.Router();

router.get('/', async (req, res) => {
    const { department, category, sort } = req.query;
  
    const filter = {};
    if (department) filter.department = department;
    if (category) filter.category = category;
  
    let sortOption = {};
    if (sort === 'name-asc') sortOption = { name: 1 };
    if (sort === 'name-desc') sortOption = { name: -1 };
    if (sort === 'time-asc') sortOption = { minTime: 1 };
    if (sort === 'time-desc') sortOption = { minTime: -1 };
  
    const rules = await TaskRules.find(filter).sort(sortOption).lean();
  
    const allRules = await TaskRules.find().lean();
    const allDepartments = [...new Set(allRules.map(r => r.department).filter(Boolean))];
    const allCategories = [...new Set(allRules.map(r => r.category).filter(Boolean))];
  
    res.render('taskrules/index', {
      rules,
      allDepartments,
      allCategories,
      selected: { department, category, sort }
    });
  });
  

router.get('/:id', async (req, res) => {
    const rule = await TaskRules.findById(req.params.id).lean();

    if (!rule) return res.status(404).send('Task Rule not found');

    const relatedTasks = await Tasks.find({ taskRuleId: rule.taskRuleId }).lean();

    res.render('taskrules/details', { rule, relatedTasks });
});

export { router }