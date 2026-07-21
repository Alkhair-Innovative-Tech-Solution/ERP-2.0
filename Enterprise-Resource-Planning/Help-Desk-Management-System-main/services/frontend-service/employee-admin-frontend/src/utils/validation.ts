export const validateEmployeeForm = (data) => {
    const errors = {};

    if (!data.firstName) {
        errors.firstName = "First name is required";
    }

    if (!data.lastName) {
        errors.lastName = "Last name is required";
    }

    if (!data.email) {
        errors.email = "Email is required";
    } else if (!/\S+@\S+\.\S+/.test(data.email)) {
        errors.email = "Email address is invalid";
    }

    if (!data.phone) {
        errors.phone = "Phone number is required";
    } else if (!/^\d{10}$/.test(data.phone)) {
        errors.phone = "Phone number must be 10 digits";
    }

    if (!data.position) {
        errors.position = "Position is required";
    }

    if (!data.salary) {
        errors.salary = "Salary is required";
    } else if (isNaN(data.salary)) {
        errors.salary = "Salary must be a number";
    }

    return {
        isValid: Object.keys(errors).length === 0,
        errors,
    };
};