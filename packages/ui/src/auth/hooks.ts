import { useContext } from 'react'
import { AuthContext } from '.'

export const useUser = () => {
    const context = useContext(AuthContext)
    if (context === undefined) {
        throw new Error('useUser must be used within an AuthProvider')
    }
    return { isLoggedIn: !!context.user, ...context }
}

export const useProtectedButtonProps = () => {
    const context = useContext(AuthContext)
    if (context === undefined) {
        throw new Error('useUser must be used within an AuthProvider')
    }
    return { isLoading: context.isLoading, isDisabled: !context.user }
}
