'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Button,
  Card,
  CardBody,
  CardFooter,
  Chip,
  Input,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Switch,
} from '@heroui/react'
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter } from '@heroui/modal'
import { useDisclosure } from '@heroui/use-disclosure'
import { PlusIcon, PencilIcon, TrashIcon, EyeIcon, EyeSlashIcon, FileTextIcon, WarningOctagonIcon, LinkIcon, ShareNetworkIcon, ArrowsClockwiseIcon, XCircleIcon, CopyIcon } from '@phosphor-icons/react'
import {
  createPaperAction,
  updatePaperAction,
  deletePaperAction,
  togglePaperVisibilityAction,
  generatePaperPasscodeAction,
  revokePaperPasscodeAction,
  rotatePaperPasscodeAction,
} from '@repo/service/paper'
import { PaperOverview } from '@repo/supabase/paper'
import { useAction } from '@repo/service'
import { QUIZ_HOSTNAME } from '@repo/env/config'
import { useCopyToClipboard } from 'usehooks-ts'
import { toast } from 'sonner'

export function PaperManagerHeader({ isCreating, handleCreate }: { isCreating?: boolean, handleCreate?: () => void }) {
  const router = useRouter()
  return (
    <div className='flex items-center my-8'>
      <div className='flex items-center gap-4'>
        <div className='hidden sm:block p-3 rounded-xl bg-primary/10 border border-primary/20'>
          <FileTextIcon size={24} className='text-primary' />
        </div>
        <div>
          <h1 className='text-2xl sm:text-3xl font-bold bg-linear-to-r from-foreground to-foreground/70 bg-clip-text text-transparent'>
            我的试卷
          </h1>
        </div>
      </div>
      <div className='flex-1'></div>
      <Button
        variant='flat'
        onPress={() => router.push('/local-editor')}
        className='mr-2'
      >
        本地编辑器
      </Button>
      <Button
        color='primary'
        variant='solid'
        startContent={<PlusIcon size={18} />}
        onPress={handleCreate}
        isDisabled={isCreating}
      >
        新建试卷
      </Button>
    </div>
  )
}

export function PaperManager({ papers: initialPapers }: { papers: PaperOverview[] }) {
  const router = useRouter()
  const [papers, setPapers] = useState(initialPapers)
  const [editingPaper, setEditingPaper] = useState<PaperOverview | null>(null)
  const [isCreateMode, setIsCreateMode] = useState(false)
  const [formData, setFormData] = useState({
    title: '',
    public: false,
  })

  const { execute: executeCreatePaper, isPending: isCreating } = useAction(createPaperAction, {
    onSuccess: (result) => {
      setPapers(prev => [result.data, ...prev])
      resetForm()
      setIsCreateMode(false)
    },
  })

  const { execute: executeUpdatePaper, isPending: isUpdating } = useAction(updatePaperAction, {
    onSuccess: (result) => {
      setPapers(prev => prev.map(p => p.id === result.data.id ? result.data : p))
      resetForm()
      setEditingPaper(null)
    },
  })

  const { execute: executeDeletePaper, isPending: isDeleting } = useAction(deletePaperAction)

  const { execute: executeToggleVisibility, isPending: isTogglingVisibility } = useAction(togglePaperVisibilityAction, {
    onSuccess: (result) => {
      setPapers(prev => prev.map(p => p.id === result.data.id ? result.data : p))
    },
  })

  const { execute: executeGeneratePasscode, isPending: isGeneratingPasscode } = useAction(generatePaperPasscodeAction, {
    onSuccess: (result) => {
      setPapers(prev => prev.map(p => p.id === result.data.id ? result.data : p))
      setSharePaper(result.data)
    },
  })

  const { execute: executeRevokePasscode, isPending: isRevokingPasscode } = useAction(revokePaperPasscodeAction, {
    onSuccess: (result) => {
      setPapers(prev => prev.map(p => p.id === result.data.id ? result.data : p))
      setSharePaper(null)
      shareModal.onClose()
      toast.success('私有链接已失效')
    },
  })

  const { execute: executeRotatePasscode, isPending: isRotatingPasscode } = useAction(rotatePaperPasscodeAction, {
    onSuccess: (result) => {
      setPapers(prev => prev.map(p => p.id === result.data.id ? result.data : p))
      setSharePaper(result.data)
      toast.success('已生成新链接，旧链接已失效')
    },
  })

  const shareModal = useDisclosure()
  const [sharePaper, setSharePaper] = useState<PaperOverview | null>(null)

  const [, copy] = useCopyToClipboard()

  const getShareUrl = (paper: PaperOverview) => {
    const protocol = window.location.protocol
    return `${protocol}//${QUIZ_HOSTNAME}/paper/${paper.id}?passcode=${paper.passcode}`
  }

  const resetForm = () => {
    setFormData({
      title: '',
      public: false,
    })
  }

  const handleCreate = () => {
    setIsCreateMode(true)
    setEditingPaper(null)
    resetForm()
  }

  const handleEdit = (paper: PaperOverview) => {
    setEditingPaper(paper)
    setIsCreateMode(false)
    setFormData({
      title: paper.title || '',
      public: paper.public,
    })
  }

  const handleSave = () => {
    if (isCreateMode) {
      executeCreatePaper({
        title: formData.title,
        public: formData.public,
      })
    } else if (editingPaper) {
      executeUpdatePaper({
        id: editingPaper.id,
        data: {
          title: formData.title,
          public: formData.public,
        }
      })
    }
  }

  const handleDelete = (id: number) => {
    setPapers(prev => prev.filter(p => p.id !== id))
    executeDeletePaper({ id })
  }

  const handleToggleVisibility = (id: number) => {
    executeToggleVisibility({ id })
  }

  return (
    <div>
      {/* Header */}
      <PaperManagerHeader isCreating={isCreating} handleCreate={handleCreate} />

      {/* Create/Edit Form */}
      {(isCreateMode || editingPaper) && (
        <Card shadow='sm' className='mb-8 border border-content2/50 backdrop-blur-sm'>
          <CardBody className='space-y-6 p-6'>
            <div className='flex items-center space-x-3'>
              <div className='w-1 h-8 bg-primary rounded-full'></div>
              <h2 className='text-xl font-semibold'>
                {isCreateMode ? '创建新试卷' : '编辑试卷'}
              </h2>
            </div>

            <div className='space-y-5'>
              <Input
                label='试卷标题'
                placeholder='一模'
                value={formData.title}
                onValueChange={(value) => setFormData(prev => ({ ...prev, title: value }))}
                variant='bordered'
                className='text-lg'
              />

              <div className='flex items-center justify-between p-4 rounded-lg bg-content2/30 border border-content2/50'>
                <div className='flex items-center space-x-3'>
                  <EyeIcon size={18} className='text-foreground/60' />
                  <span className='text-sm font-medium'>公开可见</span>
                </div>
                <Switch
                  isSelected={formData.public}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, public: value }))}
                  color='secondary'
                />
              </div>
            </div>

            <div className='flex justify-end space-x-3'>
              <Button
                variant='flat'
                onPress={() => {
                  setIsCreateMode(false)
                  setEditingPaper(null)
                  resetForm()
                }}
                className='px-6'
              >
                取消
              </Button>
              <Button
                color='primary'
                onPress={handleSave}
                isLoading={isUpdating || isCreating}
                startContent={!(isUpdating || isCreating) && (isCreateMode ? <PlusIcon size={20} /> : <PencilIcon size={20} />)}
              >
                {isCreateMode ? '创建试卷' : '保存修改'}
              </Button>
            </div>
          </CardBody>
        </Card>
      )}

      {/* Papers List */}
      <div className='grid grid-cols-1 sm:grid-cols-2 gap-6'>
        {papers.length === 0 ? (
          <Card shadow='sm' className='border border-dashed border-content2/50'>
            <CardBody className='text-center p-6'>
              <div className='mb-4'>
                <FileTextIcon size={48} className='text-foreground/20 mx-auto' />
              </div>
              <h3 className='text-lg font-medium text-foreground/70 mb-2'>
                暂无试卷
              </h3>
              <p className='text-sm text-foreground/50 mb-6'>
                开始创建你的第一篇试卷
              </p>
              <Button
                color='primary'
                variant='solid'
                startContent={<PlusIcon size={16} />}
                onPress={handleCreate}
              >
                创建第一篇试卷
              </Button>
            </CardBody>
          </Card>
        ) : (
          papers.map((paper) => (
            <Card
              key={paper.id}
              shadow='none'
              className='border border-content2 bg-default-50'
              isPressable
              as={'div'}
              onPress={() => {
                router.push(`/paper/${paper.id}`)
              }}
            >
              <CardBody className='px-6 pt-5 pb-2'>
                <div className='flex flex-col justify-between items-start'>
                  <div className='flex-1 w-full'>
                    <div className='flex items-center flex-wrap gap-1 mb-2'>
                      <Chip
                        color={paper.public ? 'secondary' : 'default'}
                        variant='dot'
                        size='sm'
                        className='font-medium'
                      >
                        {paper.public ? '公开' : '私有'}
                      </Chip>
                      {paper.tags?.slice(0, 3).map((tag, idx) => (
                        <Chip
                          key={`${tag}-${idx}`}
                          size='sm'
                          variant='flat'
                          className='bg-primary/10 text-primary border-primary/20'
                        >
                          #{tag}
                        </Chip>
                      ))}
                      {paper.tags && paper.tags.length > 3 && (
                        <Chip size='sm' variant='flat' className='bg-content2/50'>
                          +{paper.tags.length - 3}
                        </Chip>
                      )}
                      <div className='flex-1'></div>
                      <div className='flex items-center'>
                        <Button
                          isIconOnly
                          variant='light'
                          size='sm'
                          color='default'
                          onPress={() => handleToggleVisibility(paper.id)}
                          isDisabled={isTogglingVisibility}
                        >
                          {paper.public ? (
                            <EyeSlashIcon size={16} />
                          ) : (
                            <EyeIcon size={16} />
                          )}
                        </Button>
                        {!paper.public && (
                          <Button
                            isIconOnly
                            variant='light'
                            size='sm'
                            color={paper.passcode ? 'secondary' : 'default'}
                            onPress={() => {
                              setSharePaper(paper)
                              shareModal.onOpen()
                            }}
                          >
                            {paper.passcode ? <ShareNetworkIcon size={16} /> : <LinkIcon size={16} />}
                          </Button>
                        )}
                        <Button
                          isIconOnly
                          variant='light'
                          size='sm'
                          onPress={() => handleEdit(paper)}
                          isDisabled={isUpdating}
                          color='secondary'
                        >
                          <PencilIcon size={16} />
                        </Button>
                        <Popover>
                          <PopoverTrigger>
                            <Button
                              isIconOnly
                              variant='light'
                              size='sm'
                              color='danger'
                              isDisabled={isDeleting}
                            >
                              <TrashIcon size={16} />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className='p-0 w-fit'>
                            <Button
                              color='danger'
                              startContent={<WarningOctagonIcon weight='duotone' size={20} />}
                              onPress={() => handleDelete(paper.id)}
                              isDisabled={isDeleting}
                            >
                              确认删除
                            </Button>
                          </PopoverContent>
                        </Popover>
                      </div>
                    </div>

                    <div className='space-y-2'>
                      <h3 className='text-2xl truncate'>
                        {paper.title || '未命名试卷'}
                      </h3>
                    </div>
                  </div>
                </div>
              </CardBody>
              <CardFooter className='pt-0 px-6 pb-5'>
                <p className='text-xs text-foreground/50 flex items-center space-x-2'>
                  <span className='mr-1'>创建于</span>
                  <span className='font-mono'>{new Date(paper.created_at || '').toLocaleDateString('zh-CN')}</span>
                  <span className='font-mono'>•</span>
                  <span className='font-mono'>ID: {paper.id}</span>
                </p>
              </CardFooter>
            </Card>
          ))
        )}
      </div>

      {/* Share Link Modal */}
      <Modal isOpen={shareModal.isOpen} onOpenChange={shareModal.onOpenChange} backdrop='opaque'>
        <ModalContent>
          {sharePaper && (
            sharePaper.passcode ? (
              <>
                <ModalHeader>私有分享链接</ModalHeader>
                <ModalBody>
                  <p>
                    此试卷已开启私有分享。持有链接者可以直接访问、作答并查看排行榜。
                  </p>
                  <div className='flex items-center gap-2 p-3 rounded-lg bg-content2/30 border border-content2/50'>
                    <code className='text-xs flex-1 break-all text-foreground/60'>
                      {getShareUrl(sharePaper)}
                    </code>
                    <Button
                      isIconOnly
                      size='sm'
                      variant='light'
                      onPress={async () => {
                        await copy(getShareUrl(sharePaper))
                        toast.success('链接已复制')
                      }}
                    >
                      <CopyIcon size={16} />
                    </Button>
                  </div>
                </ModalBody>
                <ModalFooter className='flex-col sm:flex-row gap-2'>
                  <Button
                    color='danger'
                    variant='flat'
                    startContent={!isRevokingPasscode && <XCircleIcon size={20} />}
                    onPress={() => executeRevokePasscode({ id: sharePaper.id })}
                    isLoading={isRevokingPasscode}
                    className='w-full sm:w-auto'
                  >
                    关闭分享
                  </Button>
                  <Button
                    color='warning'
                    variant='flat'
                    startContent={!isRotatingPasscode && <ArrowsClockwiseIcon size={20} />}
                    onPress={() => executeRotatePasscode({ id: sharePaper.id })}
                    isLoading={isRotatingPasscode}
                    className='w-full sm:w-auto'
                  >
                    重新生成链接
                  </Button>
                  <Button
                    color='primary'
                    startContent={<CopyIcon size={20} />}
                    onPress={async () => {
                      await copy(getShareUrl(sharePaper))
                      toast.success('链接已复制')
                    }}
                    className='w-full sm:w-auto'
                  >
                    复制链接
                  </Button>
                </ModalFooter>
              </>
            ) : (
              <>
                <ModalHeader>开启私有分享</ModalHeader>
                <ModalBody>
                  <p>
                    为此试卷生成一个<b>私有分享链接</b>。任何持有链接者可以直接访问、作答并查看排行榜。
                  </p>
                  <p>
                    试卷本身依旧<b>不会出现</b>在公开列表中，且你可以<b>随时关闭</b>分享或重新生成链接使旧链接失效。
                  </p>
                </ModalBody>
                <ModalFooter>
                  <Button variant='flat' onPress={shareModal.onClose}>
                    取消
                  </Button>
                  <Button
                    color='primary'
                    startContent={!isGeneratingPasscode && <LinkIcon size={20} />}
                    onPress={() => executeGeneratePasscode({ id: sharePaper.id })}
                    isLoading={isGeneratingPasscode}
                  >
                    生成链接
                  </Button>
                </ModalFooter>
              </>
            )
          )}
        </ModalContent>
      </Modal>
    </div>
  )
}
