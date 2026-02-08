'use client'

import { Table, TableHeader, TableColumn, TableBody, TableRow, TableCell } from '@heroui/table'
import { ACTION_QUOTA_COST } from '@repo/env/config'

export function CostTable() {
    return (
        <Table>
            <TableHeader>
                <TableColumn className='font-medium'>操作</TableColumn>
                <TableColumn className='font-medium'>消耗「词点」</TableColumn>
                <TableColumn className='font-medium'>描述</TableColumn>
            </TableHeader>
            <TableBody>
                <TableRow key='define'>
                    <TableCell>智能查询</TableCell>
                    <TableCell>{ACTION_QUOTA_COST.quiz.annotation}</TableCell>
                    <TableCell>词汇语境化注释</TableCell>
                </TableRow>
                <TableRow key='ask'>
                    <TableCell className='whitespace-nowrap'>猫谜解惑</TableCell>
                    <TableCell>{ACTION_QUOTA_COST.quiz.ask}</TableCell>
                    <TableCell>解释练习中的题目及答案</TableCell>
                </TableRow>
                <TableRow key='gen-dictation'>
                    <TableCell>生成默写纸</TableCell>
                    <TableCell>{ACTION_QUOTA_COST.quiz.dictation}</TableCell>
                    <TableCell>根据试卷生成语块整理</TableCell>
                </TableRow>
                <TableRow key='gen-note'>
                    <TableCell>错题收录</TableCell>
                    <TableCell>{ACTION_QUOTA_COST.quiz.genNote}</TableCell>
                    <TableCell>将错题整理成条目</TableCell>
                </TableRow>
            </TableBody>
        </Table>
    )
}