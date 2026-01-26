'use client'

import { Card, CardHeader, CardBody, CardFooter, Chip } from '@heroui/react'

export function PaperCard({
    title,
    tags,
    avatar,
    createdAt
}: {
    id: number
    title: string
    tags: string[]
    avatar: React.ReactNode
    createdAt: string
}) {
    return (
        <Card shadow="sm" className="max-w-sm hover:shadow-md transition-shadow">
            <CardHeader className="flex gap-3">
                {avatar}
                <div className="flex flex-col">
                    <h3 className="text-lg font-semibold">{title}</h3>
                </div>
            </CardHeader>
            <CardBody>
                <div className="flex flex-wrap gap-2">
                    {tags.map(tag => (
                        <Chip key={tag} size="sm" variant="flat" color="primary">
                            {tag}
                        </Chip>
                    ))}
                </div>
            </CardBody>
            <CardFooter>
                <p className="text-small text-default-500">{createdAt}</p>
            </CardFooter>
        </Card>
    )
}