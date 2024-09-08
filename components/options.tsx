'use client'

import { Button } from '@nextui-org/button'
import { Input, Textarea } from '@nextui-org/input'
import {
    Modal,
    ModalContent,
    ModalHeader,
    ModalBody,
    ModalFooter,
    useDisclosure
} from '@nextui-org/modal'
import { Select, SelectItem } from '@nextui-org/select'
import { ReactElement, cloneElement } from 'react'
import { PiFloppyDiskBackDuotone, PiGearDuotone, PiShareDuotone, PiTrashDuotone } from 'react-icons/pi'
import { Accordion, AccordionItem } from '@nextui-org/accordion'
import { Divider } from '@nextui-org/divider'
import { Spacer } from '@nextui-org/spacer'
import { prefixUrl } from '@/lib/config'
import { toast } from 'sonner'

type FieldsType = {
    inputs?: {
        name: string,
        long?: boolean,
        label: string,
        description?: string,
        value?: string,
        disabled?: boolean,
        isAdvanced?: boolean,
    }[],
    selects?: {
        name: string,
        label: string,
        options: { name: string, label?: string }[],
        value?: string,
        disabled?: boolean,
        isAdvanced?: boolean,
    }[],
}

export default function Options({ inputs, selects, action, del, trigger, shareUrl }: FieldsType & {
    trigger?: JSX.Element,
    del?: () => Promise<void>,
    action: (formData: FormData) => void,
    shareUrl?: string,
}) {
    const { isOpen, onOpenChange, onOpen } = useDisclosure()
    const advancedInputs = inputs?.filter(({ isAdvanced }) => isAdvanced) ?? []
    const advancedSelects = selects?.filter(({ isAdvanced }) => isAdvanced) ?? []
    return (<div className={trigger ? undefined : 'absolute right-0.5 top-0.5 flex space-x-0.5'}>
        {shareUrl && <Button onPress={() => {
            navigator.clipboard.writeText(prefixUrl(shareUrl))
            toast.success('链接已复制到剪贴板')
        }} isIconOnly variant='light' radius='full' size='lg' color='warning' startContent={<PiShareDuotone />}></Button>}
        {trigger ? cloneElement(trigger as ReactElement, { onPress: onOpen }) : <Button onPress={onOpen} isIconOnly variant='light' radius='full' size='lg' color='warning' startContent={<PiGearDuotone />}></Button>}
        <Modal isOpen={isOpen} onOpenChange={onOpenChange}>
            <ModalContent>
                {(onClose) => (
                    <form className='w-full' action={action}>
                        <ModalHeader className='flex flex-col gap-1'>设置</ModalHeader>
                        <ModalBody>
                            <Fields inputs={inputs?.filter(({ isAdvanced }) => !isAdvanced)} selects={selects?.filter(({ isAdvanced }) => !isAdvanced)}></Fields>
                            <div className='flex justify-end'>
                                <Button color='primary' startContent={<PiFloppyDiskBackDuotone />} variant='flat' type='submit' className='my-2' onPress={onClose}>
                                    保存
                                </Button>
                            </div>
                        </ModalBody>
                        <Divider></Divider>
                        {del && <ModalFooter>
                            <div className='w-full'>
                                <Spacer y={2} />
                                <Divider></Divider>
                                {/* @ts-ignore */}
                                <Accordion isCompact fullWidth>
                                    {(advancedInputs.length > 0 || advancedSelects.length > 0) && <AccordionItem title='进阶设置' key={1}>
                                        <Fields inputs={advancedInputs} selects={advancedSelects}></Fields>
                                        <div className='flex justify-end'>
                                            <Button startContent={<PiFloppyDiskBackDuotone />} color='secondary' variant='flat' type='submit' className='my-2' onPress={onClose}>
                                                保存
                                            </Button>
                                        </div>
                                        <Spacer />
                                    </AccordionItem>}
                                    <AccordionItem title='危险操作' key={2}>
                                        <Button color='danger' startContent={<PiTrashDuotone />} fullWidth variant='ghost' onPress={async () => {
                                            await del()
                                            onClose()
                                        }}>
                                            删除
                                        </Button>
                                        <Spacer />
                                    </AccordionItem>
                                </Accordion>
                                <Divider></Divider>
                                <Spacer y={2} />
                            </div>
                        </ModalFooter>}
                    </form>
                )}
            </ModalContent>
        </Modal>
    </div>)
}

function Fields({ inputs, selects }: FieldsType) {
    return (<div className='flex flex-col space-y-2'>
        {inputs && inputs.length > 0 && inputs.map(({ name, long, label, value, disabled, description }) => (
            long
                ? <Textarea maxRows={3} isDisabled={disabled} defaultValue={value} key={name} name={name} label={label} />
                : <Input isDisabled={disabled} defaultValue={value} description={description} key={name} name={name} label={label} />
        ))}
        {selects && selects.length > 0 && selects.map(({ name, options, label, value, disabled }) => (
            <Select
                defaultSelectedKeys={value && [value]}
                isDisabled={disabled}
                key={name}
                name={name}
                label={label}
            >
                {options.map(({ name, label }) => (
                    <SelectItem key={name} value={name}>
                        {label ?? name}
                    </SelectItem>
                ))}
            </Select>
        ))}
    </div>)
}
