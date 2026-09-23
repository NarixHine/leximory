'use client'

import {
    Button,
    Popover,
    PopoverContent,
    PopoverTrigger,
    Select,
    SelectItem,
} from '@heroui/react'
import {
    PiArrowsDownUp,
    PiCaretDown,
    PiCaretUp,
    PiPlus,
    PiSortAscending,
    PiSortDescending,
    PiX,
} from 'react-icons/pi'
import {
    DEFAULT_SORT,
    isDefaultSort,
    SORT_FIELDS,
    SORT_KEYS,
    SortKey,
    SortRule,
} from '../sort'
function moveRule(rules: SortRule[], index: number, delta: number) {
    const target = index + delta
    if (target < 0 || target >= rules.length) return rules

    const next = [...rules]
    ;[next[index], next[target]] = [next[target], next[index]]
    return next
}

export default function SortControl({
    rules,
    onChange,
}: {
    rules: SortRule[]
    onChange: (rules: SortRule[]) => void
}) {
    const used = new Set(rules.map(rule => rule.column))
    const canAdd = rules.length < SORT_KEYS.length

    const updateRule = (index: number, patch: Partial<SortRule>) => {
        onChange(rules.map((rule, i) => (i === index ? { ...rule, ...patch } : rule)))
    }

    const addRule = () => {
        const nextKey = SORT_KEYS.find(key => !used.has(key))
        if (nextKey) onChange([...rules, { column: nextKey, direction: 'ascending' }])
    }

    return (
        <Popover
            placement='bottom-start'
            shouldCloseOnInteractOutside={element =>
                !element.closest('[role="listbox"]')
            }
            classNames={{ content: 'p-0' }}
        >
            <PopoverTrigger>
                <Button
                    size='sm'
                    variant='flat'
                    color='default'
                    className='shrink-0'
                    startContent={<PiArrowsDownUp className='size-4' />}
                >
                    Sort
                    {rules.length > 0 && (
                        <span className='ml-1 rounded-full bg-default-200/70 px-1.5 font-mono text-[10px] tabular-nums text-default-700'>
                            {rules.length}
                        </span>
                    )}
                </Button>
            </PopoverTrigger>

            <PopoverContent>
                <div className='flex w-96 max-w-[calc(100vw-2rem)] flex-col gap-3 p-4'>
                    <div className='flex items-center justify-between'>
                        <span className='font-formal text-sm text-default-600'>Sort rules</span>
                        <Button
                            size='sm'
                            variant='light'
                            color='default'
                            isDisabled={isDefaultSort(rules)}
                            onPress={() => onChange(DEFAULT_SORT)}
                        >
                            Reset
                        </Button>
                    </div>

                    {rules.length === 0 ? (
                        <p className='rounded-xl bg-default-50 px-3 py-4 text-xs text-default-600'>
                            No sort rules. Rows keep the order returned by the server.
                        </p>
                    ) : (
                        <div className='flex flex-col gap-2'>
                            {rules.map((rule, index) => (
                                <div key={rule.column} className='flex items-center gap-1.5'>
                                    <span className='w-3 shrink-0 text-center font-mono text-[10px] text-default-500 tabular-nums'>
                                        {index + 1}
                                    </span>
                                    <Select
                                        size='sm'
                                        aria-label={`Sort field ${index + 1}`}
                                        className='min-w-0 flex-1'
                                        classNames={{ trigger: 'h-8 min-h-8' }}
                                        selectedKeys={[rule.column]}
                                        disallowEmptySelection
                                        onChange={event =>
                                            updateRule(index, {
                                                column: event.target.value as SortKey,
                                            })
                                        }
                                    >
                                        {SORT_KEYS.map(key => (
                                            <SelectItem
                                                key={key}
                                                isDisabled={used.has(key) && rule.column !== key}
                                            >
                                                {SORT_FIELDS[key].label}
                                            </SelectItem>
                                        ))}
                                    </Select>
                                    <Button
                                        isIconOnly
                                        size='sm'
                                        variant='flat'
                                        color='default'
                                        aria-label={
                                            rule.direction === 'ascending'
                                                ? 'Sort ascending'
                                                : 'Sort descending'
                                        }
                                        onPress={() =>
                                            updateRule(index, {
                                                direction:
                                                    rule.direction === 'ascending'
                                                        ? 'descending'
                                                        : 'ascending',
                                            })
                                        }
                                    >
                                        {rule.direction === 'ascending' ? (
                                            <PiSortAscending className='size-4' />
                                        ) : (
                                            <PiSortDescending className='size-4' />
                                        )}
                                    </Button>
                                    <Button
                                        isIconOnly
                                        size='sm'
                                        variant='light'
                                        aria-label='Move sort up'
                                        isDisabled={index === 0}
                                        onPress={() => onChange(moveRule(rules, index, -1))}
                                    >
                                        <PiCaretUp className='size-3.5' />
                                    </Button>
                                    <Button
                                        isIconOnly
                                        size='sm'
                                        variant='light'
                                        aria-label='Move sort down'
                                        isDisabled={index === rules.length - 1}
                                        onPress={() => onChange(moveRule(rules, index, 1))}
                                    >
                                        <PiCaretDown className='size-3.5' />
                                    </Button>
                                    <Button
                                        isIconOnly
                                        size='sm'
                                        variant='light'
                                        color='danger'
                                        aria-label='Remove sort'
                                        onPress={() =>
                                            onChange(rules.filter((_, i) => i !== index))
                                        }
                                    >
                                        <PiX className='size-3.5' />
                                    </Button>
                                </div>
                            ))}
                        </div>
                    )}

                    <Button
                        size='sm'
                        variant='flat'
                        color='default'
                        className='w-full'
                        startContent={<PiPlus className='size-4' />}
                        isDisabled={!canAdd}
                        onPress={addRule}
                    >
                        {canAdd ? 'Add sort level' : 'All fields in use'}
                    </Button>
                </div>
            </PopoverContent>
        </Popover>
    )
}
