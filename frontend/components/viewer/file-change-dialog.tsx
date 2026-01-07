import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

interface FileChangeDialogProps {
  open: boolean
  fileName: string
  onKeepChanges: () => void
  onReload: () => void
}

export function FileChangeDialog({
  open,
  fileName,
  onKeepChanges,
  onReload,
}: FileChangeDialogProps) {
  return (
    <AlertDialog open={open}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>File Changed Externally</AlertDialogTitle>
          <AlertDialogDescription>
            The file "{fileName}" has been modified outside the editor. You have
            unsaved changes. What would you like to do?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onKeepChanges}>
            Keep my changes
          </AlertDialogCancel>
          <AlertDialogAction onClick={onReload}>Reload file</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
