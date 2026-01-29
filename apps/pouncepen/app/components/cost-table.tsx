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
                <TableRow key='review'>
                    <TableCell className='whitespace-nowrap'>AI Agent</TableCell>
                    <TableCell>{ACTION_QUOTA_COST.pouncepen.agent}</TableCell>
                    <TableCell>全自动高质量出题</TableCell>
                </TableRow>
                <TableRow key='import'>
                    <TableCell>试卷导入</TableCell>
                    <TableCell>{ACTION_QUOTA_COST.pouncepen.import}</TableCell>
                    <TableCell>智能将试卷扫描入 PouncePen</TableCell>
                </TableRow>
                <TableRow key='gen-quiz'>
                    <TableCell>智能出题</TableCell>
                    <TableCell>{ACTION_QUOTA_COST.pouncepen.genQuiz}</TableCell>
                    <TableCell>将文本出成小猫钓鱼/完形填空/阅读</TableCell>
                </TableRow>
                <TableRow key='review'>
                    <TableCell>审题</TableCell>
                    <TableCell>{ACTION_QUOTA_COST.pouncepen.answer + ACTION_QUOTA_COST.pouncepen.verdict}</TableCell>
                    <TableCell>检阅该大题有无歧义</TableCell>
                </TableRow>
            </TableBody>
        </Table>
    )
}